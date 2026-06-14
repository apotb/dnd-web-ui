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
