import type { AbilityKey } from "@/lib/schemas/character";

export type FeatAbilityBonusMode = "fixed" | "choice";

export interface FeatAbilityBonusConfig {
  mode: FeatAbilityBonusMode;
  /** Fixed bonuses applied when mode is "fixed". */
  fixed?: Partial<Record<AbilityKey, number>>;
  /** Options when mode is "choice" (player picks one). */
  choices?: Array<Partial<Record<AbilityKey, number>>>;
}

/** PHB feat ability score increases for level-up feat selection. */
export const FEAT_ABILITY_BONUSES: Record<string, FeatAbilityBonusConfig> = {
  actor: { mode: "fixed", fixed: { cha: 1 } },
  athlete: {
    mode: "choice",
    choices: [{ str: 1 }, { dex: 1 }],
  },
  durable: { mode: "fixed", fixed: { con: 1 } },
  "heavily-armored": { mode: "fixed", fixed: { str: 1 } },
  "keen-mind": { mode: "fixed", fixed: { int: 1 } },
  "lightly-armored": {
    mode: "choice",
    choices: [{ str: 1 }, { dex: 1 }],
  },
  "moderately-armored": {
    mode: "choice",
    choices: [{ str: 1 }, { dex: 1 }],
  },
  observant: {
    mode: "choice",
    choices: [{ int: 1 }, { wis: 1 }],
  },
  resilient: {
    mode: "choice",
    choices: [
      { str: 1 },
      { dex: 1 },
      { con: 1 },
      { int: 1 },
      { wis: 1 },
      { cha: 1 },
    ],
  },
  "tavern-brawler": {
    mode: "choice",
    choices: [{ str: 1 }, { con: 1 }],
  },
  "weapon-master": {
    mode: "choice",
    choices: [{ str: 1 }, { dex: 1 }],
  },
};

export function getFeatAbilityBonusConfig(
  featId: string
): FeatAbilityBonusConfig | undefined {
  return FEAT_ABILITY_BONUSES[featId];
}
