import type { FeatureChoices } from "@/lib/schemas/character";

export interface FavoredEnemyPick {
  enemy: string;
  humanoidSpecies: string[];
}

/** PHB: 1 at 1st, +1 at 6th, +1 at 14th. */
export function getFavoredEnemySlotCount(level: number): number {
  if (level >= 14) return 3;
  if (level >= 6) return 2;
  return 1;
}

/** PHB: 1 at 1st, +1 at 6th, +1 at 10th. */
export function getFavoredTerrainSlotCount(level: number): number {
  if (level >= 10) return 3;
  if (level >= 6) return 2;
  return 1;
}

function emptyEnemyPick(): FavoredEnemyPick {
  return { enemy: "", humanoidSpecies: [] };
}

/** Pad or trim enemy picks to the required slot count for the given level. */
export function normalizeFavoredEnemyPicks(
  picks: FavoredEnemyPick[],
  level: number
): FavoredEnemyPick[] {
  const count = getFavoredEnemySlotCount(level);
  const result = picks.slice(0, count).map((p) => ({
    enemy: p.enemy ?? "",
    humanoidSpecies: p.humanoidSpecies ?? [],
  }));
  while (result.length < count) {
    result.push(emptyEnemyPick());
  }
  return result;
}

/** Pad or trim terrain picks to the required slot count for the given level. */
export function normalizeFavoredTerrains(terrains: string[], level: number): string[] {
  const count = getFavoredTerrainSlotCount(level);
  const result = terrains.slice(0, count).map((t) => t ?? "");
  while (result.length < count) {
    result.push("");
  }
  return result;
}

/** Read normalized ranger picks from featureChoices at the given character level. */
export function getRangerPicksFromChoices(
  choices: FeatureChoices | undefined,
  level: number
): { enemyPicks: FavoredEnemyPick[]; terrains: string[] } {
  const rawPicks = choices?.favoredEnemyPicks ?? [];
  const rawTerrains = choices?.favoredTerrains ?? [];

  if (rawPicks.length === 0 && choices?.favoredEnemy) {
    return {
      enemyPicks: normalizeFavoredEnemyPicks(
        [
          {
            enemy: choices.favoredEnemy,
            humanoidSpecies: choices.favoredHumanoidSpecies ?? [],
          },
        ],
        level
      ),
      terrains: normalizeFavoredTerrains(
        choices.favoredTerrain ? [choices.favoredTerrain] : [],
        level
      ),
    };
  }

  return {
    enemyPicks: normalizeFavoredEnemyPicks(rawPicks, level),
    terrains: normalizeFavoredTerrains(rawTerrains, level),
  };
}

/** True when ranger has unfilled pick slots at the given level. */
export function rangerHasUnfilledPickSlots(
  choices: FeatureChoices | undefined,
  level: number
): boolean {
  const { enemyPicks, terrains } = getRangerPicksFromChoices(choices, level);
  if (enemyPicks.some((p) => !p.enemy.trim())) return true;
  if (terrains.some((t) => !t.trim())) return true;
  return false;
}

/** Levels where ranger gains additional favored enemy or terrain picks. */
export function isRangerPickLevelUpLevel(level: number): boolean {
  return level === 6 || level === 10 || level === 14;
}
