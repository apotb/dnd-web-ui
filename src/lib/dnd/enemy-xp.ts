import { parseChallengeRatingValue } from "@/lib/combat/saved-encounters";
import type { EnemyData } from "@/lib/schemas/enemy";

/** DMG experience points by challenge rating (CR 0 through 30). */
const XP_BY_CR: readonly number[] = [
  10, // 0
  200, // 1
  450, // 2
  700, // 3
  1100, // 4
  1800, // 5
  2300, // 6
  2900, // 7
  3900, // 8
  5000, // 9
  5900, // 10
  7200, // 11
  8400, // 12
  10000, // 13
  11500, // 14
  13000, // 15
  15000, // 16
  18000, // 17
  20000, // 18
  22000, // 19
  25000, // 20
  33000, // 21
  41000, // 22
  50000, // 23
  62000, // 24
  75000, // 25
  90000, // 26
  105000, // 27
  120000, // 28
  135000, // 29
  155000, // 30
];

const FRACTIONAL_CR_XP: Record<string, number> = {
  "1/8": 25,
  "1/4": 50,
  "1/2": 100,
};

/** Returns XP for a challenge rating string (e.g. "1/2", "3", "0"). */
export function xpFromChallengeRating(cr: string): number {
  const trimmed = cr.trim();
  if (!trimmed) return XP_BY_CR[0];

  if (trimmed in FRACTIONAL_CR_XP) {
    return FRACTIONAL_CR_XP[trimmed];
  }

  const numeric = parseChallengeRatingValue(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;

  if (numeric < 1) {
    if (Math.abs(numeric - 0.125) < 0.001) return 25;
    if (Math.abs(numeric - 0.25) < 0.001) return 50;
    if (Math.abs(numeric - 0.5) < 0.001) return 100;
    return XP_BY_CR[0];
  }

  const index = Math.min(30, Math.max(0, Math.round(numeric)));
  return XP_BY_CR[index] ?? 0;
}

/** Uses catalog XP when set; otherwise derives from challenge rating. */
export function getEnemyXpValue(data: EnemyData): number {
  if (data.xp > 0) return data.xp;
  return xpFromChallengeRating(data.challengeRating);
}
