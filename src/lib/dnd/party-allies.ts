import { getEnemyInitiativeBreakdown } from "@/lib/combat/initiative";
import {
  ensureZeroHpDownedConditions,
  syncDownedConditionsAfterHpChange,
} from "@/lib/dnd/dying-state";
import { speciesSubtitleLabel } from "@/lib/content/catalog-tooltip";
import { parseChallengeRatingValue } from "@/lib/combat/saved-encounters";
import type { EnemyRecord } from "@/lib/combat/state-utils";
import type { CombatState } from "@/lib/schemas/combat-state";
import { parseEnemyData } from "@/lib/schemas/enemy";
import type { PartyAlly, PartyData } from "@/lib/schemas/party";
import { partyAllySchema } from "@/lib/schemas/party";
import { PHB_SPECIES } from "@/lib/dnd/phb/species";
import type { PhbSpecies } from "@/lib/dnd/phb/types";

export function createPartyAllyFromEnemy(enemy: EnemyRecord): PartyAlly {
  const data = parseEnemyData(enemy.data);
  return partyAllySchema.parse({
    name: enemy.name,
    sourceEnemySlug: enemy.slug,
    sourceEnemyName: enemy.name,
    data,
    currentHp: data.hitPoints.average,
  });
}

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Creature archetype for overview cards (e.g. Thug, Scout). */
export function getAllyArchetypeLabel(ally: PartyAlly): string {
  const fromName = ally.sourceEnemyName?.trim();
  if (fromName) return fromName;

  if (ally.sourceEnemySlug) {
    return titleCaseSlug(ally.sourceEnemySlug);
  }

  const tag = ally.data.tags.find((entry) => entry.trim());
  if (tag) return tag;

  return "Ally";
}

/** Race + archetype subtitle (e.g. "Human Thug"), matching party species/class tooltips. */
export function getAllyRaceClassLine(
  ally: PartyAlly,
  speciesList: PhbSpecies[] = PHB_SPECIES
): string {
  return [
    speciesSubtitleLabel(ally.race, speciesList),
    getAllyArchetypeLabel(ally),
  ]
    .filter(Boolean)
    .join(" ");
}

export function getAllyMaxHp(ally: PartyAlly): number {
  return ally.data.hitPoints.average;
}

export function getAllyInitiativeModifier(ally: PartyAlly): number {
  return getEnemyInitiativeBreakdown(ally.data).modifier;
}

export function parseAllySpeedFt(speed: string): number | null {
  const match = speed.match(/(\d+)\s*ft/i);
  if (!match) return null;
  return Number(match[1]);
}

export function getAllyPassivePerception(ally: PartyAlly): number {
  const senses = ally.data.senses;
  const passiveMatch = senses.match(/passive\s+perception\s+(\d+)/i);
  if (passiveMatch) {
    return Number(passiveMatch[1]);
  }

  const perceptionSkill = ally.data.skills.find(
    (skill) => skill.name.trim().toLowerCase() === "perception"
  );
  if (perceptionSkill) {
    return 10 + perceptionSkill.bonus;
  }

  const wisMod = Math.floor((ally.data.abilityScores.wis - 10) / 2);
  return 10 + wisMod;
}

function allyConditionsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const leftSet = new Set(left);
  return right.every((slug) => leftSet.has(slug));
}

export function syncAllyCombatToPartyData(
  partyData: PartyData,
  combatState: CombatState
): PartyData {
  const allyTokens = combatState.tokens.filter(
    (token) => token.kind === "ally" && token.allyId
  );
  if (allyTokens.length === 0) return partyData;

  const tokenByAllyId = new Map(
    allyTokens.map((token) => [token.allyId!, token])
  );

  let changed = false;
  const allies = partyData.allies.map((ally) => {
    const token = tokenByAllyId.get(ally.id);
    if (!token) return ally;

    const tokenHp = token.currentHp ?? 0;
    const previousHp = ally.currentHp;
    let conditions = syncDownedConditionsAfterHpChange(
      previousHp,
      tokenHp,
      ally.conditions ?? []
    );
    if (tokenHp === 0) {
      conditions = ensureZeroHpDownedConditions(conditions);
    }

    const hpChanged = tokenHp !== ally.currentHp;
    const conditionsChanged = !allyConditionsEqual(conditions, ally.conditions ?? []);
    if (!hpChanged && !conditionsChanged) return ally;

    changed = true;
    return { ...ally, currentHp: tokenHp, conditions };
  });

  return changed ? { ...partyData, allies } : partyData;
}

/** @deprecated Use syncAllyCombatToPartyData */
export const syncAllyHpToPartyData = syncAllyCombatToPartyData;

export function listPartyAllies(partyData: PartyData): PartyAlly[] {
  return [...partyData.allies].sort((a, b) => {
    const crDiff =
      parseChallengeRatingValue(a.data.challengeRating) -
      parseChallengeRatingValue(b.data.challengeRating);
    if (crDiff !== 0) return crDiff;
    return a.name.localeCompare(b.name);
  });
}
