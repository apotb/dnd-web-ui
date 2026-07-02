import type { CharacterData } from "@/lib/schemas/character";

/** Minimum XP required for each level (index 0 = level 1, index 19 = level 20). */
export const XP_THRESHOLDS: readonly number[] = [
  0,       // level 1
  300,     // level 2
  900,     // level 3
  2_700,   // level 4
  6_500,   // level 5
  14_000,  // level 6
  23_000,  // level 7
  34_000,  // level 8
  48_000,  // level 9
  64_000,  // level 10
  85_000,  // level 11
  100_000, // level 12
  120_000, // level 13
  140_000, // level 14
  165_000, // level 15
  195_000, // level 16
  225_000, // level 17
  265_000, // level 18
  305_000, // level 19
  355_000, // level 20
];

/** Returns the character level (1–20) for a given XP total. */
export function levelFromXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < XP_THRESHOLDS.length; i++) {
    if (xp >= XP_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

/** Returns the minimum XP needed to reach a given level (clamped 1–20). */
export function xpForLevel(level: number): number {
  return XP_THRESHOLDS[Math.max(0, Math.min(19, level - 1))];
}

export interface XpProgress {
  level: number;
  /** XP accumulated since the start of the current level. */
  progressXp: number;
  /** XP needed to reach the next level from the start of the current level. */
  neededXp: number;
  /** Percentage progress to the next level (0–100). 100 if already level 20. */
  pct: number;
  /** Total XP for next level, or null at max level. */
  nextLevelXp: number | null;
}

/** Returns progress data for the XP bar. */
export function xpProgress(xp: number): XpProgress {
  const level = levelFromXp(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = level < 20 ? xpForLevel(level + 1) : null;

  if (nextLevelXp === null) {
    return { level, progressXp: 0, neededXp: 0, pct: 100, nextLevelXp: null };
  }

  const progressXp = xp - currentLevelXp;
  const neededXp = nextLevelXp - currentLevelXp;
  const pct = Math.min(100, Math.floor((progressXp / neededXp) * 100));

  return { level, progressXp, neededXp, pct, nextLevelXp };
}

/** Committed character level (what the player has leveled into). */
export function getCommittedLevel(data: CharacterData): number {
  return Math.max(1, Math.min(20, data.basicInfo.level ?? 1));
}

/** Alias used across game logic — committed level, not XP-derived. */
export function getCharacterLevel(data: CharacterData): number {
  return getCommittedLevel(data);
}

/** True when XP is enough to level up one more step from the committed level. */
export function canLevelUp(committedLevel: number, xp: number): boolean {
  if (committedLevel >= 20) return false;
  return xp >= xpForLevel(committedLevel + 1);
}

export function canCharacterLevelUp(data: CharacterData): boolean {
  return canLevelUp(getCommittedLevel(data), data.basicInfo.xp ?? 0);
}

/** Target level for the next pending level-up (always committed + 1). */
export function getNextLevelUpTarget(committedLevel: number, xp: number): number | null {
  if (!canLevelUp(committedLevel, xp)) return null;
  return committedLevel + 1;
}

export function getCharacterNextLevelUpTarget(data: CharacterData): number | null {
  const level = getCommittedLevel(data);
  return getNextLevelUpTarget(level, data.basicInfo.xp ?? 0);
}

/** XP bar progress relative to committed level (not XP-derived level). */
export function xpProgressForLevel(committedLevel: number, xp: number): XpProgress {
  const level = Math.max(1, Math.min(20, committedLevel));
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = level < 20 ? xpForLevel(level + 1) : null;

  if (nextLevelXp === null) {
    return { level, progressXp: 0, neededXp: 0, pct: 100, nextLevelXp: null };
  }

  const progressXp = Math.max(0, xp - currentLevelXp);
  const neededXp = nextLevelXp - currentLevelXp;
  const pct = Math.min(100, Math.floor((progressXp / neededXp) * 100));

  return { level, progressXp, neededXp, pct, nextLevelXp };
}
