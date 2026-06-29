import { resolveCharacterClass } from "@/lib/character/class-derivation";
import {
  calculateEffectiveMaxHpBreakdown,
  getHitDiceRemaining,
  getHitDiceTotal,
  getHitDieSides,
  syncCombatDerivedStats,
} from "@/lib/character/combat-derivation";
import { abilityModifier } from "@/lib/dnd/calculations";
import { removeOneExhaustionLevel } from "@/lib/dnd/exhaustion";
import { sameHarptosDate, type HarptosDate } from "@/lib/dnd/harptos-calendar";
import type { CharacterData, Feature } from "@/lib/schemas/character";
import type { PhbClass } from "@/lib/dnd/phb/types";
import type { PhbSpecies } from "@/lib/dnd/phb/types";

export type RestKind = "short" | "long";

export interface RestBlockReason {
  ok: false;
  reason: string;
}

export interface RestAllowed {
  ok: true;
}

export type RestAvailability = RestAllowed | RestBlockReason;

export function hasLongRestedToday(
  data: CharacterData,
  campaignDate: HarptosDate
): boolean {
  const last = data.combat.lastLongRestDate;
  return !!last && sameHarptosDate(last, campaignDate);
}

export function canTakeLongRest(
  data: CharacterData,
  campaignDate: HarptosDate,
  isDm: boolean
): RestAvailability {
  if (data.combat.currentHp <= 0) {
    return {
      ok: false,
      reason: "Cannot long rest at 0 HP or below",
    };
  }
  if (!isDm && hasLongRestedToday(data, campaignDate)) {
    return { ok: false, reason: "Already rested today" };
  }
  return { ok: true };
}

export function getLongRestHitDiceRecovery(totalHitDice: number): number {
  return Math.max(1, Math.floor(totalHitDice / 2));
}

function isWarlock(data: CharacterData, classes?: PhbClass[]): boolean {
  return resolveCharacterClass(data, classes)?.id === "warlock";
}

function resetSpellSlots(
  spells: CharacterData["spells"],
  mode: "all" | "warlock-only",
  isWarlockClass: boolean
): CharacterData["spells"] {
  if (mode === "warlock-only" && !isWarlockClass) return spells;

  const slots: CharacterData["spells"]["slots"] = {};
  for (const [key, slot] of Object.entries(spells.slots)) {
    slots[key] = { ...slot, used: 0 };
  }
  return { ...spells, slots };
}

function resetFeatureUses(
  features: Feature[],
  restKind: RestKind
): Feature[] {
  return features.map((feature) => {
    if (!feature.uses) return feature;
    if (restKind === "short" && feature.restReset !== "short") return feature;
    if (
      restKind === "long" &&
      feature.restReset !== "short" &&
      feature.restReset !== "long"
    ) {
      return feature;
    }
    return {
      ...feature,
      uses: { ...feature.uses, current: feature.uses.max },
    };
  });
}

/** Labels for abilities that recharge on a short rest for this character. */
export function getShortRestRestorations(
  data: CharacterData,
  classes?: PhbClass[]
): string[] {
  const items: string[] = [];

  if (isWarlock(data, classes)) {
    const hasUsedSlots = Object.values(data.spells.slots).some(
      (slot) => slot.used > 0
    );
    if (hasUsedSlots) {
      items.push("Spell slots");
    }
  }

  for (const feature of data.features) {
    if (feature.restReset !== "short" || !feature.uses) continue;
    if (feature.uses.current < feature.uses.max) {
      const name = feature.name.trim() || "Unnamed feature";
      items.push(`${name} (${feature.uses.current}/${feature.uses.max})`);
    }
  }

  return items;
}

/** Labels for custom features that recharge on a long rest. */
export function getLongRestRestorations(
  data: CharacterData
): string[] {
  const items: string[] = [];

  for (const feature of data.features) {
    if (!feature.uses) continue;
    if (feature.restReset !== "short" && feature.restReset !== "long") continue;
    if (feature.uses.current < feature.uses.max) {
      const name = feature.name.trim() || "Unnamed feature";
      items.push(`${name} (${feature.uses.current}/${feature.uses.max})`);
    }
  }

  return items;
}

export function applySingleHitDieHeal(
  data: CharacterData,
  roll: number,
  classes?: PhbClass[],
  speciesList?: PhbSpecies[]
): CharacterData {
  const total = getHitDiceTotal(data, classes);
  const remaining = getHitDiceRemaining(data, classes);
  if (remaining <= 0) return data;

  const { total: maxHp } = calculateEffectiveMaxHpBreakdown(
    data,
    classes,
    speciesList
  );
  if (data.combat.currentHp >= maxHp) return data;

  const conModifier = abilityModifier(data.abilityScores.con);
  const healed = Math.max(0, roll + conModifier);
  const nextHp = Math.min(maxHp, data.combat.currentHp + healed);

  const next: CharacterData = {
    ...data,
    combat: {
      ...data.combat,
      currentHp: nextHp,
      hitDiceSpent: Math.min(total, (data.combat.hitDiceSpent ?? 0) + 1),
    },
  };

  return syncCombatDerivedStats(next, classes, speciesList);
}

/** Mark character as mid-short-rest (healing step must be completed). */
export function startPendingShortRest(data: CharacterData): CharacterData {
  return {
    ...data,
    combat: {
      ...data.combat,
      pendingShortRest: true,
    },
  };
}

function clearPendingShortRest(data: CharacterData): CharacterData {
  return {
    ...data,
    combat: {
      ...data.combat,
      pendingShortRest: false,
    },
  };
}

/** Recharge short-rest spell slots and feature uses. */
export function applyShortRestFinish(
  data: CharacterData,
  classes?: PhbClass[],
  speciesList?: PhbSpecies[]
): CharacterData {
  const warlock = isWarlock(data, classes);
  const next: CharacterData = clearPendingShortRest({
    ...data,
    spells: resetSpellSlots(data.spells, "warlock-only", warlock),
    features: resetFeatureUses(data.features, "short"),
  });
  return syncCombatDerivedStats(next, classes, speciesList);
}

/** Character state after long rest reduces exhaustion by one level (if any). */
export function getDataAfterLongRestExhaustionReduction(
  data: CharacterData
): CharacterData {
  if (data.exhaustionLevels.length === 0) return data;
  return removeOneExhaustionLevel(data);
}

/** HP restored by a long rest — effective max after exhaustion is reduced first. */
export function getLongRestHpRestoreTarget(
  data: CharacterData,
  classes?: PhbClass[],
  speciesList?: PhbSpecies[]
): number {
  const afterExhaustion = getDataAfterLongRestExhaustionReduction(data);
  return calculateEffectiveMaxHpBreakdown(
    afterExhaustion,
    classes,
    speciesList
  ).total;
}

export function applyLongRest(
  data: CharacterData,
  campaignDate: HarptosDate,
  classes?: PhbClass[],
  speciesList?: PhbSpecies[]
): CharacterData {
  const total = getHitDiceTotal(data, classes);
  const spent = data.combat.hitDiceSpent ?? 0;
  const recovery = getLongRestHitDiceRecovery(total);
  const nextSpent = Math.max(0, spent - recovery);

  const afterExhaustion = getDataAfterLongRestExhaustionReduction(data);
  const restoreHp = getLongRestHpRestoreTarget(data, classes, speciesList);

  const next: CharacterData = {
    ...afterExhaustion,
    combat: {
      ...afterExhaustion.combat,
      currentHp: restoreHp,
      hitDiceSpent: nextSpent,
      lastLongRestDate: campaignDate,
      concentration: { active: false, spell: "" },
    },
    spells: resetSpellSlots(afterExhaustion.spells, "all", isWarlock(data, classes)),
    features: resetFeatureUses(afterExhaustion.features, "long"),
  };

  return syncCombatDerivedStats(next, classes, speciesList);
}

export function describeLongRestEffects(
  data: CharacterData,
  classes?: PhbClass[],
  speciesList?: PhbSpecies[]
): string[] {
  const restoreHp = getLongRestHpRestoreTarget(data, classes, speciesList);
  const totalDice = getHitDiceTotal(data, classes);
  const hitDiceRemaining = getHitDiceRemaining(data, classes);
  const hitDiceSpent = totalDice - hitDiceRemaining;
  const hitDiceRecovery = Math.min(
    getLongRestHitDiceRecovery(totalDice),
    hitDiceSpent
  );
  const lines: string[] = [];

  if (data.combat.currentHp < restoreHp) {
    lines.push(`Restore HP to ${restoreHp}`);
  }
  if (hitDiceRemaining < totalDice && hitDiceRecovery > 0) {
    lines.push(
      `Recover ${hitDiceRecovery} hit ${hitDiceRecovery === 1 ? "die" : "dice"}`
    );
  }

  if (data.exhaustionLevels.length > 0) {
    lines.push("Reduce exhaustion by 1 level");
  }
  const cls = resolveCharacterClass(data, classes);
  if (
    cls?.spellcasting &&
    Object.values(data.spells.slots).some((slot) => slot.used > 0)
  ) {
    lines.push("Restore all spell slots");
  }
  if (data.combat.concentration?.active) {
    lines.push("End concentration");
  }
  return lines;
}
