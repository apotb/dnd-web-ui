import { z } from "zod";

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const abilityKeySchema = z.enum([
  "str",
  "dex",
  "con",
  "int",
  "wis",
  "cha",
]);

export const skillKeySchema = z.enum([
  "acrobatics",
  "animalHandling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleightOfHand",
  "stealth",
  "survival",
]);

export const savingThrowKeySchema = abilityKeySchema;

export const restResetTypeSchema = z.enum([
  "short",
  "long",
  "none",
]);

export const damageTypeSchema = z.string().min(1);

// ---------------------------------------------------------------------------
// Character sub-schemas
// ---------------------------------------------------------------------------

export const basicInfoSchema = z.object({
  name: z.string().default(""),
  playerName: z.string().default(""),
  level: z.number().int().min(1).max(30).default(1),
  classes: z.array(z.string()).default([]),
  class: z.string().optional(), // legacy single-class field
  subclass: z.string().default(""),
  species: z.string().default(""),
  background: z.string().default(""),
  alignment: z.string().default(""),
  portrait: z.string().default(""),
  publicNotes: z.string().default(""),
  dmNotes: z.string().default(""),
});

export const abilityScoresSchema = z.object({
  str: z.number().int().min(1).max(30).default(10),
  dex: z.number().int().min(1).max(30).default(10),
  con: z.number().int().min(1).max(30).default(10),
  int: z.number().int().min(1).max(30).default(10),
  wis: z.number().int().min(1).max(30).default(10),
  cha: z.number().int().min(1).max(30).default(10),
});

export const skillProficiencySchema = z.object({
  proficient: z.boolean().default(false),
  expertise: z.boolean().default(false),
  override: z.number().optional(),
});

export const skillsSchema = z.record(z.string(), skillProficiencySchema);

export const savingThrowsSchema = z.record(
  z.string(),
  z.object({ proficient: z.boolean().default(false) })
);

export const deathSavesSchema = z.object({
  successes: z.number().int().min(0).max(3).default(0),
  failures: z.number().int().min(0).max(3).default(0),
});

export const combatStatsSchema = z.object({
  ac: z.number().int().min(0).default(10),
  maxHp: z.number().int().min(0).default(1),
  currentHp: z.number().int().default(1),
  tempHp: z.number().int().min(0).default(0),
  initiativeBonus: z.number().default(0),
  speed: z.number().int().min(0).default(30),
  passivePerceptionOverride: z.number().optional(),
  hitDice: z.string().default("1d8"),
  deathSaves: deathSavesSchema.default({ successes: 0, failures: 0 }),
  conditions: z.array(z.string()).default([]),
  exhaustion: z.number().int().min(0).max(6).default(0),
  concentration: z
    .object({
      active: z.boolean().default(false),
      spell: z.string().default(""),
    })
    .default({ active: false, spell: "" }),
});

export const attackSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  name: z.string().default(""),
  attackBonus: z.number().default(0),
  damageDice: z.string().default(""),
  damageType: damageTypeSchema.default(""),
  range: z.string().default(""),
  notes: z.string().default(""),
});

export const spellSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  name: z.string().default(""),
  level: z.number().int().min(0).max(9).default(0),
  prepared: z.boolean().default(false),
  notes: z.string().default(""),
});

export const spellSlotsSchema = z.record(
  z.string(),
  z.object({
    max: z.number().int().min(0).default(0),
    used: z.number().int().min(0).default(0),
  })
);

export const spellsSchema = z.object({
  spellcastingAbility: abilityKeySchema.optional(),
  spellSaveDcOverride: z.number().optional(),
  spellAttackBonusOverride: z.number().optional(),
  slots: spellSlotsSchema.default({}),
  known: z.array(spellSchema).default([]),
  prepared: z.array(spellSchema).default([]),
});

export const inventoryItemSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  name: z.string().default(""),
  quantity: z.number().int().min(0).default(1),
  equipped: z.boolean().default(false),
  magicItem: z.boolean().default(false),
  notes: z.string().default(""),
});

export const currencySchema = z.object({
  cp: z.number().int().min(0).default(0),
  sp: z.number().int().min(0).default(0),
  ep: z.number().int().min(0).default(0),
  gp: z.number().int().min(0).default(0),
  pp: z.number().int().min(0).default(0),
});

export const inventorySchema = z.object({
  currency: currencySchema.default({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }),
  items: z.array(inventoryItemSchema).default([]),
  notes: z.string().default(""),
});

export const featureSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  name: z.string().default(""),
  description: z.string().default(""),
  uses: z
    .object({
      current: z.number().int().min(0).default(0),
      max: z.number().int().min(0).default(0),
    })
    .optional(),
  restReset: restResetTypeSchema.default("long"),
});

// ---------------------------------------------------------------------------
// Full character data schema
// ---------------------------------------------------------------------------

export const characterDataSchema = z.object({
  basicInfo: basicInfoSchema.default(() => basicInfoSchema.parse({})),
  abilityScores: abilityScoresSchema.default(() => abilityScoresSchema.parse({})),
  proficiencyBonusOverride: z.number().optional(),
  savingThrows: savingThrowsSchema.default({}),
  skills: skillsSchema.default({}),
  combat: combatStatsSchema.default(() => combatStatsSchema.parse({})),
  attacks: z.array(attackSchema).default([]),
  spells: spellsSchema.default(() => spellsSchema.parse({})),
  inventory: inventorySchema.default(() => inventorySchema.parse({})),
  features: z.array(featureSchema).default([]),
});

export type AbilityKey = z.infer<typeof abilityKeySchema>;
export type SkillKey = z.infer<typeof skillKeySchema>;
export type BasicInfo = z.infer<typeof basicInfoSchema>;
export type AbilityScores = z.infer<typeof abilityScoresSchema>;
export type SkillProficiency = z.infer<typeof skillProficiencySchema>;
export type CombatStats = z.infer<typeof combatStatsSchema>;
export type Attack = z.infer<typeof attackSchema>;
export type Spell = z.infer<typeof spellSchema>;
export type Spells = z.infer<typeof spellsSchema>;
export type Inventory = z.infer<typeof inventorySchema>;
export type Feature = z.infer<typeof featureSchema>;
export type CharacterData = z.infer<typeof characterDataSchema>;

/** Light validation for import — coerces defaults rather than rejecting. */
export function parseCharacterData(input: unknown): CharacterData {
  return characterDataSchema.parse(input);
}

export function safeParseCharacterData(input: unknown) {
  return characterDataSchema.safeParse(input);
}

/** Strip DM-only fields for player-facing views. */
export function stripDmNotesFromCharacterData(
  data: CharacterData
): CharacterData {
  return {
    ...data,
    basicInfo: {
      ...data.basicInfo,
      dmNotes: "",
    },
  };
}

export function createDefaultCharacterData(
  overrides?: Partial<Omit<CharacterData, "basicInfo">> & {
    basicInfo?: Partial<BasicInfo>;
  }
): CharacterData {
  return characterDataSchema.parse(overrides ?? {});
}

/** Export/import envelope including top-level name fields. */
export const characterExportSchema = z.object({
  version: z.literal(1),
  name: z.string(),
  playerName: z.string(),
  data: characterDataSchema,
});

export type CharacterExport = z.infer<typeof characterExportSchema>;
