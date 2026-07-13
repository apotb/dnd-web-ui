import {
  applyConditionSlugs,
  normalizeCombatConditions,
  removeConditionSlugs,
} from "@/lib/dnd/conditions";
import {
  AUTO_ZERO_HP_CONDITIONS,
  DYING_CONDITION_SLUG,
  ensureZeroHpDownedConditions,
  syncDownedConditionsAfterHpChange,
} from "@/lib/dnd/dying-state";
import type { ParsedCharacter } from "@/lib/character/utils";
import type { CombatToken } from "@/lib/schemas/combat-state";
import type { PartyAlly } from "@/lib/schemas/party";

export const EXHAUSTION_CONDITION_SLUG = "exhaustion";

export function syncExhaustionCondition(
  conditions: string[],
  exhaustionLevel: number
): string[] {
  if (exhaustionLevel > 0) {
    return applyConditionSlugs(conditions, [EXHAUSTION_CONDITION_SLUG]);
  }
  return removeConditionSlugs(conditions, [EXHAUSTION_CONDITION_SLUG]);
}

export function resolveManagedConditions(
  conditions: string[],
  effectiveHp: number,
  exhaustionLevel: number
): string[] {
  let next = conditions;
  if (effectiveHp === 0) {
    next = ensureZeroHpDownedConditions(next);
  }
  return syncExhaustionCondition(next, exhaustionLevel);
}

export function getProtectedConditionNote(slug: string): string {
  if (slug === EXHAUSTION_CONDITION_SLUG) {
    return "Synced from exhaustion levels";
  }
  if (
    slug === DYING_CONDITION_SLUG ||
    (AUTO_ZERO_HP_CONDITIONS as readonly string[]).includes(slug)
  ) {
    return "Auto-applied at 0 HP";
  }
  return "Cannot be removed while active";
}

export function getConditionsForToken(
  token: CombatToken,
  character?: ParsedCharacter | null,
  ally?: PartyAlly | null
): string[] {
  if (token.kind === "party" && character) {
    return resolveManagedConditions(
      character.data.combat.conditions ?? [],
      character.data.combat.currentHp,
      character.data.exhaustionLevels?.length ?? 0
    );
  }
  if (token.kind === "ally" && ally) {
    return ally.conditions ?? [];
  }
  if (token.kind === "enemy") {
    return token.conditions ?? [];
  }
  return [];
}

/** Slugs the DM cannot remove while auto-managed effects are active. */
export function getDmProtectedConditionSlugs(
  effectiveHp: number,
  conditions: string[],
  exhaustionLevel = 0
): string[] {
  const protectedSlugs = new Set<string>();

  if (effectiveHp === 0) {
    for (const slug of AUTO_ZERO_HP_CONDITIONS) {
      protectedSlugs.add(slug);
    }
    if (conditions.includes(DYING_CONDITION_SLUG)) {
      protectedSlugs.add(DYING_CONDITION_SLUG);
    }
  }

  if (exhaustionLevel > 0) {
    protectedSlugs.add(EXHAUSTION_CONDITION_SLUG);
  }

  return [...protectedSlugs];
}

/** Re-apply protected slugs on save so blocked removals cannot slip through. */
export function finalizeDmConditionEdit(
  proposed: string[],
  effectiveHp: number,
  current: string[],
  exhaustionLevel = 0
): string[] {
  const normalized = normalizeCombatConditions(proposed);
  const protectedSlugs = getDmProtectedConditionSlugs(
    effectiveHp,
    current,
    exhaustionLevel
  );
  if (protectedSlugs.length === 0) return normalized;

  const merged = new Set(normalized);
  for (const slug of protectedSlugs) {
    if (slug === EXHAUSTION_CONDITION_SLUG && exhaustionLevel > 0) {
      merged.add(slug);
      continue;
    }
    if (current.includes(slug)) merged.add(slug);
  }
  return normalizeCombatConditions([...merged]);
}

export function syncTokenConditionsAfterHpChange(
  previousHp: number,
  newHp: number,
  conditions: string[]
): string[] {
  return syncDownedConditionsAfterHpChange(previousHp, newHp, conditions);
}

export function conditionsEqual(a: string[], b: string[]): boolean {
  const left = new Set(normalizeCombatConditions(a));
  const right = new Set(normalizeCombatConditions(b));
  if (left.size !== right.size) return false;
  for (const slug of left) {
    if (!right.has(slug)) return false;
  }
  return true;
}
