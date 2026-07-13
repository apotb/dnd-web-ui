import {
  applyConditionSlugs,
  removeConditionSlugs,
} from "@/lib/dnd/conditions";
import type { CharacterData } from "@/lib/schemas/character";

export const DYING_CONDITION_SLUG = "dying";
export const DEAD_CONDITION_SLUG = "dead";

export const DEATH_SAVE_DEATH_MESSAGE = "You have died.";

export const AUTO_ZERO_HP_CONDITIONS = [
  "incapacitated",
  "unconscious",
  "prone",
] as const;

/** Removed when HP rises above 0; prone persists until the creature stands up. */
export const WAKE_FROM_ZERO_HP_CONDITIONS = [
  "incapacitated",
  "unconscious",
] as const;

const ALL_AUTO_DOWNED_CONDITIONS = [
  DYING_CONDITION_SLUG,
  DEAD_CONDITION_SLUG,
  ...WAKE_FROM_ZERO_HP_CONDITIONS,
] as const;

export function hasDyingCondition(combat: CharacterData["combat"]): boolean {
  return (combat.conditions ?? []).includes(DYING_CONDITION_SLUG);
}

export function hasDeadCondition(combat: CharacterData["combat"]): boolean {
  return (combat.conditions ?? []).includes(DEAD_CONDITION_SLUG);
}

export function isCharacterDead(combat: CharacterData["combat"]): boolean {
  return hasDeadCondition(combat);
}

export function getDeathSaveDeathMessage(): string {
  return DEATH_SAVE_DEATH_MESSAGE;
}

export function needsDeathSavingThrow(combat: CharacterData["combat"]): boolean {
  return (
    combat.currentHp === 0 &&
    hasDyingCondition(combat) &&
    !hasDeadCondition(combat)
  );
}

/** Official death from three death saving throw failures. */
export function applyDeathFromSavingThrows(
  combat: CharacterData["combat"]
): CharacterData["combat"] {
  const conditions = applyConditionSlugs(
    removeConditionSlugs(combat.conditions ?? [], [DYING_CONDITION_SLUG]),
    [DEAD_CONDITION_SLUG, ...AUTO_ZERO_HP_CONDITIONS]
  );
  return {
    ...combat,
    currentHp: 0,
    conditions,
    deathSaves: { successes: combat.deathSaves.successes, failures: 3 },
  };
}

/** Reset death saves when the dead condition is cleared (e.g. resurrection). */
export function syncDeathSavesAfterDeadRemoved(
  previousCombat: CharacterData["combat"],
  nextCombat: CharacterData["combat"]
): CharacterData["combat"] {
  if (hasDeadCondition(previousCombat) && !hasDeadCondition(nextCombat)) {
    return {
      ...nextCombat,
      deathSaves: { successes: 0, failures: 0 },
    };
  }
  return nextCombat;
}

/** Apply prone, unconscious, and incapacitated without dying or death-save resets. */
export function ensureZeroHpDownedConditions(conditions: string[]): string[] {
  return applyConditionSlugs(conditions, [...AUTO_ZERO_HP_CONDITIONS]);
}

/** Sync auto-downed conditions after an HP change (allies and enforcement paths). */
export function syncDownedConditionsAfterHpChange(
  previousHp: number,
  newHp: number,
  conditions: string[]
): string[] {
  if (previousHp > 0 && newHp === 0) {
    return ensureZeroHpDownedConditions(conditions);
  }
  if (previousHp === 0 && newHp > 0) {
    return removeConditionSlugs(conditions, [...WAKE_FROM_ZERO_HP_CONDITIONS]);
  }
  if (newHp === 0) {
    return ensureZeroHpDownedConditions(conditions);
  }
  return conditions;
}

export function applyKnockToZeroHp(
  combat: CharacterData["combat"]
): CharacterData["combat"] {
  if (hasDeadCondition(combat)) {
    return {
      ...combat,
      currentHp: 0,
      conditions: ensureZeroHpDownedConditions(combat.conditions ?? []),
    };
  }
  const conditions = applyConditionSlugs(combat.conditions ?? [], [
    DYING_CONDITION_SLUG,
    ...AUTO_ZERO_HP_CONDITIONS,
  ]);
  return {
    ...combat,
    currentHp: 0,
    conditions,
    deathSaves: { successes: 0, failures: 0 },
  };
}

export function applyStabilize(
  combat: CharacterData["combat"]
): CharacterData["combat"] {
  const conditions = removeConditionSlugs(combat.conditions ?? [], [
    DYING_CONDITION_SLUG,
  ]);
  return {
    ...combat,
    conditions,
    deathSaves: { successes: 0, failures: 0 },
  };
}

export function applyWakeFromZeroHp(
  combat: CharacterData["combat"],
  newHp: number
): CharacterData["combat"] {
  const conditions = removeConditionSlugs(combat.conditions ?? [], [
    ...ALL_AUTO_DOWNED_CONDITIONS,
  ]);
  return {
    ...combat,
    currentHp: newHp,
    conditions,
    deathSaves: { successes: 0, failures: 0 },
  };
}

export function applyDamageAtZeroHp(
  combat: CharacterData["combat"],
  options: { isCritical?: boolean } = {}
): CharacterData["combat"] {
  if (hasDeadCondition(combat)) return combat;

  const failureDelta = options.isCritical ? 2 : 1;
  const failures = Math.min(3, combat.deathSaves.failures + failureDelta);
  let conditions = combat.conditions ?? [];

  if (!hasDyingCondition(combat)) {
    conditions = applyConditionSlugs(conditions, [DYING_CONDITION_SLUG]);
  }

  const nextCombat: CharacterData["combat"] = {
    ...combat,
    conditions,
    deathSaves: {
      successes: combat.deathSaves.successes,
      failures,
    },
  };

  if (failures >= 3) {
    return applyDeathFromSavingThrows(nextCombat);
  }

  return nextCombat;
}

export interface SyncCombatAfterHpChangeOptions {
  previousHp: number;
  /** Damage dealt to current HP (after temp HP), if any. */
  damageToHp?: number;
  isCritical?: boolean;
}

/**
 * Apply dying / stable / wake transitions after an HP change.
 * Call with the combat state *before* applying the raw HP delta, plus the new HP.
 */
export function syncCombatAfterHpChange(
  combat: CharacterData["combat"],
  newHp: number,
  options: SyncCombatAfterHpChangeOptions
): CharacterData["combat"] {
  const { previousHp, damageToHp = 0, isCritical = false } = options;

  if (hasDeadCondition(combat) && newHp === 0) {
    return {
      ...combat,
      currentHp: 0,
      conditions: ensureZeroHpDownedConditions(combat.conditions ?? []),
    };
  }

  const next: CharacterData["combat"] = {
    ...combat,
    currentHp: newHp,
  };

  let result: CharacterData["combat"];

  if (previousHp > 0 && newHp === 0) {
    result = applyKnockToZeroHp(next);
  } else if (previousHp === 0 && newHp > 0) {
    result = applyWakeFromZeroHp(next, newHp);
  } else if (newHp === 0 && damageToHp > 0) {
    result = applyDamageAtZeroHp(next, { isCritical });
  } else {
    result = next;
  }

  if (newHp === 0) {
    result = {
      ...result,
      conditions: ensureZeroHpDownedConditions(result.conditions ?? []),
    };
  }

  return result;
}
