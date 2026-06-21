import { z } from "zod";
import { abilityKeySchema } from "@/lib/schemas/character";

export const enemySkillSchema = z.object({
  name: z.string().default(""),
  bonus: z.number().int().default(0),
});

export const enemyNamedBlockSchema = z.object({
  name: z.string().default(""),
  description: z.string().default(""),
});

export const enemyArmorClassSchema = z.object({
  value: z.number().int().min(0).default(10),
  note: z.string().default(""),
});

export const enemyHitPointsSchema = z.object({
  average: z.number().int().min(0).default(1),
  formula: z.string().default(""),
});

export const enemyDataSchema = z.object({
  sizeType: z.string().default(""),
  armorClass: enemyArmorClassSchema.default({ value: 10, note: "" }),
  hitPoints: enemyHitPointsSchema.default({ average: 1, formula: "" }),
  speed: z.string().default("30 ft."),
  abilityScores: z
    .record(abilityKeySchema, z.number().int().min(1).max(30))
    .default({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
  skills: z.array(enemySkillSchema).default([]),
  senses: z.string().default(""),
  languages: z.string().default(""),
  challengeRating: z.string().default("0"),
  xp: z.number().int().min(0).default(0),
  proficiencyBonus: z.number().int().min(0).default(2),
  traits: z.array(enemyNamedBlockSchema).default([]),
  actions: z.array(enemyNamedBlockSchema).default([]),
  description: z.string().default(""),
  tags: z.array(z.string()).default([]),
  habitat: z.string().default(""),
  portraitPath: z.string().default(""),
});

export type EnemyData = z.infer<typeof enemyDataSchema>;
export type EnemySkill = z.infer<typeof enemySkillSchema>;
export type EnemyNamedBlock = z.infer<typeof enemyNamedBlockSchema>;

export function parseEnemyData(input: unknown): EnemyData {
  return enemyDataSchema.parse(input ?? {});
}

export function createDefaultEnemyData(
  overrides?: Partial<EnemyData>
): EnemyData {
  return enemyDataSchema.parse(overrides ?? {});
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatAbilityScore(score: number): string {
  const mod = abilityModifier(score);
  const sign = mod >= 0 ? "+" : "";
  return `${score} (${sign}${mod})`;
}
