/** Standard ASI levels for most PHB classes. */
const STANDARD_ASI_LEVELS = [4, 8, 12, 16, 19] as const;

const FIGHTER_ASI_LEVELS = [4, 6, 8, 12, 14, 16, 19] as const;
const ROGUE_ASI_LEVELS = [4, 8, 10, 12, 16, 19] as const;

const ASI_LEVELS_BY_CLASS: Record<string, readonly number[]> = {
  fighter: FIGHTER_ASI_LEVELS,
  rogue: ROGUE_ASI_LEVELS,
};

export function getAsiLevelsForClass(classId: string): readonly number[] {
  return ASI_LEVELS_BY_CLASS[classId] ?? STANDARD_ASI_LEVELS;
}

export function isAsiLevel(classId: string, level: number): boolean {
  return getAsiLevelsForClass(classId).includes(level);
}
