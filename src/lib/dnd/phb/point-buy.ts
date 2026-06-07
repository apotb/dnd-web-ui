import type { AbilityKey } from "@/lib/schemas/character";

/** PHB standard point-buy costs (score before racial bonuses). */
export const POINT_BUY_COSTS: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

export const POINT_BUY_TOTAL = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

export const ABILITY_KEYS: AbilityKey[] = [
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha",
];

export function pointBuyCost(score: number): number {
  return POINT_BUY_COSTS[score] ?? 0;
}

export function pointBuySpent(scores: Record<AbilityKey, number>): number {
  return ABILITY_KEYS.reduce((sum, key) => sum + pointBuyCost(scores[key]), 0);
}

export function isValidPointBuy(scores: Record<AbilityKey, number>): boolean {
  for (const key of ABILITY_KEYS) {
    const score = scores[key];
    if (score < POINT_BUY_MIN || score > POINT_BUY_MAX) return false;
  }
  return pointBuySpent(scores) === POINT_BUY_TOTAL;
}

export function defaultPointBuyScores(): Record<AbilityKey, number> {
  return { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
}
