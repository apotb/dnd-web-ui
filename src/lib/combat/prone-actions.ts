import { hasAthleteFeat } from "@/lib/character/character-feats";
import { getSpeciesSpeedFromCharacter } from "@/lib/character/combat-derivation";
import type { ParsedCharacter } from "@/lib/character/utils";
import { getConditionsForToken } from "@/lib/combat/combat-conditions";
import type { CombatOption } from "@/lib/combat/combat-options";
import {
  getTokenStatusEntries,
  type TokenStatusContext,
} from "@/lib/combat/feature-effects";
import { getMovementBudgetFeet, parseEnemySpeedFt } from "@/lib/combat/movement";
import { applyGetUpMovementUsed } from "@/lib/combat/turn";
import { normalizeCombatConditions, removeConditionSlugs } from "@/lib/dnd/conditions";
import type { PhbSpecies } from "@/lib/dnd/phb/types";
import type { EnemyData } from "@/lib/schemas/enemy";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import type { PartyAlly, PartyData } from "@/lib/schemas/party";

export const COMBAT_GET_UP_OPTION_ID = "combat:get-up";

/** Matches prone status chips on the combat board (character, ally, enemy, and effect slugs). */
export function isTokenProne(
  token: CombatToken,
  context?: TokenStatusContext,
  character?: ParsedCharacter | null,
  ally?: PartyAlly | null
): boolean {
  if (getTokenStatusEntries(token, context).some((entry) => entry.slug === "prone")) {
    return true;
  }
  return normalizeCombatConditions(
    getConditionsForToken(token, character, ally)
  ).includes("prone");
}

export function getGetUpMovementCostFt(
  character: ParsedCharacter,
  speciesList?: PhbSpecies[]
): number {
  if (hasAthleteFeat(character.data)) return 5;
  const baseSpeedFt = getSpeciesSpeedFromCharacter(character.data, speciesList ?? []);
  return Math.floor(baseSpeedFt / 2);
}

export function getGetUpMovementCostForToken(
  token: CombatToken,
  character: ParsedCharacter | null,
  enemyData: EnemyData | null,
  speciesList?: PhbSpecies[]
): number {
  if (token.kind === "party" && character) {
    return getGetUpMovementCostFt(character, speciesList);
  }
  if (enemyData) {
    return Math.floor(parseEnemySpeedFt(enemyData.speed) / 2);
  }
  return 15;
}

export function buildGetUpCombatOption(context: {
  costFeet: number;
  remainingMovementFeet: number;
}): CombatOption {
  const affordable = context.remainingMovementFeet >= context.costFeet;
  return {
    id: COMBAT_GET_UP_OPTION_ID,
    name: "Get Up",
    subtitle: `${context.costFeet} ft`,
    tooltip:
      "Stand up and end the Prone condition. Costs movement equal to half your base speed (5 ft with Athlete).",
    kind: "movement",
    getUp: {
      costFeet: context.costFeet,
      remainingMovementFeet: context.remainingMovementFeet,
      affordable,
    },
  };
}

export function buildCrawlCombatOption(context: {
  remainingMovementFeet: number;
}): CombatOption {
  const affordable = context.remainingMovementFeet > 0;
  return {
    id: "combat:crawl",
    name: "Crawl",
    subtitle: `${context.remainingMovementFeet} ft left`,
    tooltip:
      "Crawl while prone. For every foot you travel, you consume an extra foot of movement. You remain prone.",
    kind: "movement",
    crawl: {
      remainingMovementFeet: context.remainingMovementFeet,
      affordable,
    },
  };
}

export function applyCombatGetUp(
  state: CombatState,
  tokenId: string,
  costFeet: number,
  speedFt: number,
  dashUsed: boolean
): CombatState {
  const { maxRemainingFeet } = getMovementBudgetFeet(
    speedFt,
    state.turn.movementUsedFeet,
    dashUsed,
    state.turn.actionUsed
  );
  let next = applyGetUpMovementUsed(state, costFeet, maxRemainingFeet);
  if (next.turn.movementUsedFeet === state.turn.movementUsedFeet) return state;

  const token = next.tokens.find((entry) => entry.id === tokenId);
  if (!token) return state;

  if (token.kind === "enemy") {
    const conditions = removeConditionSlugs(token.conditions ?? [], ["prone"]);
    next = {
      ...next,
      tokens: next.tokens.map((entry) =>
        entry.id === tokenId ? { ...entry, conditions } : entry
      ),
    };
  }

  return next;
}

export function removeProneFromCharacterData(
  character: ParsedCharacter
): ParsedCharacter["data"]["combat"]["conditions"] {
  return removeConditionSlugs(character.data.combat.conditions ?? [], ["prone"]);
}

export function removeProneFromAlly(ally: PartyAlly): PartyAlly {
  const conditions = removeConditionSlugs(ally.conditions ?? [], ["prone"]);
  if (conditions.length === (ally.conditions ?? []).length) return ally;
  return { ...ally, conditions };
}

export function removeProneFromPartyData(
  partyData: PartyData,
  allyId: string
): PartyData {
  let changed = false;
  const allies = partyData.allies.map((ally) => {
    if (ally.id !== allyId) return ally;
    const next = removeProneFromAlly(ally);
    if (next !== ally) changed = true;
    return next;
  });
  return changed ? { ...partyData, allies } : partyData;
}
