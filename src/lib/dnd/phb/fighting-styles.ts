import { FIGHTING_STYLES } from "@/lib/dnd/phb/classes";

const PALADIN_FIGHTING_STYLES = [
  "Defense",
  "Dueling",
  "Great Weapon Fighting",
  "Protection",
] as const;

const RANGER_FIGHTING_STYLES = [
  "Archery",
  "Defense",
  "Dueling",
  "Two-Weapon Fighting",
] as const;

const FIGHTING_STYLE_UNLOCK_LEVEL: Partial<Record<string, number>> = {
  fighter: 1,
  paladin: 2,
  ranger: 2,
};

const FIGHTING_STYLE_OPTIONS: Partial<Record<string, readonly string[]>> = {
  fighter: FIGHTING_STYLES,
  paladin: PALADIN_FIGHTING_STYLES,
  ranger: RANGER_FIGHTING_STYLES,
};

/** Level at which the class gains its fighting style feature. */
export function getFightingStyleUnlockLevel(classId: string): number | null {
  return FIGHTING_STYLE_UNLOCK_LEVEL[classId] ?? null;
}

/** PHB fighting style options for the given class. */
export function getFightingStyleOptions(classId: string): readonly string[] {
  return FIGHTING_STYLE_OPTIONS[classId] ?? FIGHTING_STYLES;
}

/** True when the character has reached the level that grants fighting style. */
export function hasFightingStyleAtLevel(classId: string, characterLevel: number): boolean {
  const unlock = getFightingStyleUnlockLevel(classId);
  return unlock != null && characterLevel >= unlock;
}

/** True when leveling crosses the fighting style unlock and no style is chosen yet. */
export function needsFightingStylePick(
  classId: string,
  currentLevel: number,
  targetLevel: number,
  fightingStyle: string | undefined
): boolean {
  if (fightingStyle?.trim()) return false;
  const unlock = getFightingStyleUnlockLevel(classId);
  if (unlock == null) return false;
  return currentLevel < unlock && targetLevel >= unlock;
}
