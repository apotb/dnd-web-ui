import type { PhbSpell } from "@/lib/dnd/phb/types";

export type SpellCastingCost = "action" | "bonus-action" | "reaction";

const NON_COMBAT_CAST_TIME =
  /\d+\s*(?:minute|minutes|hour|hours|day|days)\b/;

/** Casting times longer than a single turn cannot be used in combat action economy. */
export function isNonCombatCastingTime(castingTime: string): boolean {
  const normalized = castingTime.trim().toLowerCase();
  if (!normalized) return true;
  if (NON_COMBAT_CAST_TIME.test(normalized)) return true;
  if (/^\d+\s*rounds?\b/.test(normalized)) return true;
  return false;
}

/** Map catalog casting time to combat action economy. */
export function getSpellCastingCost(castingTime: string): SpellCastingCost | null {
  const normalized = castingTime.trim().toLowerCase();
  if (!normalized || isNonCombatCastingTime(castingTime)) return null;
  if (normalized.startsWith("1 bonus action")) return "bonus-action";
  if (normalized.startsWith("1 reaction")) return "reaction";
  if (normalized === "1 action" || normalized.startsWith("1 action ")) return "action";
  return null;
}

/** True when a spell can be cast on a single combat turn (action or bonus action). */
export function isSpellCastableInCombat(
  catalog: Pick<PhbSpell, "castingTime">
): boolean {
  const cost = getSpellCastingCost(catalog.castingTime);
  return cost === "action" || cost === "bonus-action";
}
