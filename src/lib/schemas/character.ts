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
  /** Kept for backward-compat / export; derived from xp at runtime. */
  level: z.number().int().min(1).max(30).default(1),
  /** Total XP. Level is computed from this; level field is legacy. */
  xp: z.number().int().min(0).default(0),
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

export const actionCostSchema = z.enum([
  "action",
  "bonus-action",
  "reaction",
  "movement",
  "free",
]);

export const characterActionSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  name: z.string().default(""),
  cost: actionCostSchema.default("action"),
  description: z.string().default(""),
});

export const spellSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  /** References spells.slug in the catalog. Absent = custom spell. */
  spellId: z.string().optional(),
  name: z.string().default(""),
  level: z.number().int().min(0).max(9).default(0),
  prepared: z.boolean().default(false),
  notes: z.string().default(""),
  /** Tracks spells auto-added from species/feats/background features. */
  grantKey: z.string().optional(),
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
  /** When true, the spellcasting block is hidden on the read-only sheet. */
  spellcastingHidden: z.boolean().default(false),
  spellSaveDcOverride: z.number().optional(),
  spellAttackBonusOverride: z.number().optional(),
  slots: spellSlotsSchema.default({}),
  known: z.array(spellSchema).default([]),
  prepared: z.array(spellSchema).default([]),
});

export const inventoryItemSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  /** References items.slug in the catalog. Absent = custom (non-catalogued) item. */
  itemId: z.string().optional(),
  name: z.string().default(""),
  quantity: z.number().int().min(0).default(1),
  weightLb: z.number().min(0).optional(),
  equipped: z.boolean().default(false),
  /** Main hand (weapons only). */
  wieldMain: z.boolean().default(false),
  /** Off hand — light weapons only; bonus-action attack in 5e. */
  wieldOff: z.boolean().default(false),
  attuned: z.boolean().default(false),
  magicItem: z.boolean().default(false),
  notes: z.string().default(""),
});

/** Player-selected options for class/species features with choices (not starting gear/languages). */
export const featureChoicesSchema = z.object({
  fightingStyle: z.string().default(""),
  favoredEnemy: z.string().default(""),
  /** When favoredEnemy is "Two humanoid species", stores up to two species ids. */
  favoredHumanoidSpecies: z.array(z.string()).max(2).default([]),
  favoredTerrain: z.string().default(""),
  /** Feat id (e.g. alert) for Variant Human. */
  variantHumanFeat: z.string().default(""),
  /** Magic Initiate feat — spell list and picks. */
  magicInitiateClass: z.enum(["", "cleric", "druid", "wizard"]).default(""),
  magicInitiateCantripIds: z.array(z.string()).max(2).default([]),
  magicInitiateSpellId: z.string().default(""),
});

/** Species creation choices persisted for edit-time grant sync. */
export const speciesChoicesSchema = z.object({
  halfElfAbilityBonuses: z.array(abilityKeySchema).max(2).default([]),
  speciesSkillChoices: z.array(skillKeySchema).default([]),
  speciesWeaponChoices: z.array(z.string()).default([]),
  speciesToolChoice: z.string().default(""),
  speciesSkillOrTool: z.enum(["", "skill", "tool"]).default(""),
  variantHumanAbilityBonuses: z.array(abilityKeySchema).max(2).default([]),
  variantHumanSkill: z.union([skillKeySchema, z.literal("")]).default(""),
  /** Pickable species cantrip (e.g. High Elf wizard cantrip). */
  speciesCantripId: z.string().default(""),
});

/** Background creation choices persisted for edit-time grant sync. */
export const backgroundChoicesSchema = z.object({
  backgroundSkillChoices: z.array(skillKeySchema).default([]),
  backgroundToolPick: z
    .enum(["", "gaming set", "artisan's tools", "musical instrument"])
    .default(""),
  backgroundToolMulti: z
    .array(z.enum(["thieves' tools", "gaming set", "musical instrument"]))
    .default([]),
  backgroundArtisanTool: z.string().default(""),
  backgroundGamingSet: z.string().default(""),
  backgroundMusicalInstrument: z.string().default(""),
  backgroundExplorerTool: z.string().default(""),
});

export const abilityScoreBreakdownEntrySchema = z.object({
  base: z.number().int(),
  racial: z.number().int().default(0),
  other: z.number().int().default(0),
  sources: z
    .array(z.object({ label: z.string(), value: z.number().int() }))
    .default([]),
});

export const abilityScoreBreakdownSchema = z.record(
  abilityKeySchema,
  abilityScoreBreakdownEntrySchema
);

const CURRENCY_KEYS = ["cp", "sp", "ep", "gp", "pp"] as const;

/** Clamp invalid stored currency (negatives, NaN) before validation. */
export function normalizeCurrency(val: unknown): Record<(typeof CURRENCY_KEYS)[number], number> {
  const defaults = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  if (!val || typeof val !== "object" || Array.isArray(val)) return defaults;

  const obj = val as Record<string, unknown>;
  const normalized = { ...defaults };
  for (const key of CURRENCY_KEYS) {
    const raw = obj[key];
    const n = typeof raw === "number" ? raw : parseInt(String(raw ?? 0), 10);
    normalized[key] = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
  }
  return normalized;
}

export const currencySchema = z.preprocess(
  normalizeCurrency,
  z.object({
    cp: z.number().int().min(0).default(0),
    sp: z.number().int().min(0).default(0),
    ep: z.number().int().min(0).default(0),
    gp: z.number().int().min(0).default(0),
    pp: z.number().int().min(0).default(0),
  })
);

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

/** Strip invalid custom mod values (NaN, non-numeric strings) before validation. */
export function normalizeCustomAbilityMods(
  val: unknown
): Partial<Record<z.infer<typeof abilityKeySchema>, number>> | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val !== "object" || Array.isArray(val)) return undefined;

  const normalized: Partial<Record<z.infer<typeof abilityKeySchema>, number>> = {};

  for (const key of abilityKeySchema.options) {
    const raw = (val as Record<string, unknown>)[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
    if (Number.isFinite(n)) normalized[key] = Math.trunc(n);
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

// ---------------------------------------------------------------------------
// Full character data schema
// ---------------------------------------------------------------------------

/** Migrate legacy character JSON keys before validation. */
function migrateCharacterDataKeys(val: unknown): unknown {
  if (!val || typeof val !== "object" || Array.isArray(val)) return val;
  const obj = { ...(val as Record<string, unknown>) };

  if ("raceLanguageChoices" in obj && !("speciesLanguageChoices" in obj)) {
    obj.speciesLanguageChoices = obj.raceLanguageChoices;
    delete obj.raceLanguageChoices;
  }

  if (
    obj.featureChoices &&
    typeof obj.featureChoices === "object" &&
    !Array.isArray(obj.featureChoices)
  ) {
    const fc = { ...(obj.featureChoices as Record<string, unknown>) };
    if ("favoredHumanoidRaces" in fc && !("favoredHumanoidSpecies" in fc)) {
      fc.favoredHumanoidSpecies = fc.favoredHumanoidRaces;
      delete fc.favoredHumanoidRaces;
    }
    if (fc.favoredEnemy === "Two humanoid races") {
      fc.favoredEnemy = "Two humanoid species";
    }
    obj.featureChoices = fc;
  }

  return obj;
}

export const characterDataSchema = z.preprocess(
  migrateCharacterDataKeys,
  z.object({
  basicInfo: basicInfoSchema.default(() => basicInfoSchema.parse({})),
  abilityScores: abilityScoresSchema.default(() => abilityScoresSchema.parse({})),
  abilityScoreBreakdown: abilityScoreBreakdownSchema.optional(),
  customAbilityMods: z.preprocess(
    normalizeCustomAbilityMods,
    z.partialRecord(abilityKeySchema, z.number().int()).optional()
  ),
  proficiencyBonusOverride: z.number().optional(),
  /** DM-granted inspiration points (max = proficiency bonus). */
  inspiration: z.number().int().min(0).default(0),
  savingThrows: savingThrowsSchema.default({}),
  skills: skillsSchema.default({}),
  languages: z.array(z.string()).default([]),
  /** Player-chosen bonus languages from species (language slugs or legacy names). */
  speciesLanguageChoices: z.array(z.string()).default([]),
  /** Player-chosen bonus languages from background (language slugs or legacy names). */
  backgroundLanguageChoices: z.array(z.string()).default([]),
  toolProficiencies: z.array(z.string()).default([]),
  weaponProficiencies: z.array(z.string()).default([]),
  armorProficiencies: z.array(z.string()).default([]),
  combat: combatStatsSchema.default(() => combatStatsSchema.parse({})),
  attacks: z.array(attackSchema).default([]),
  /** Player-added custom actions (core and feature actions are derived at runtime). */
  customActions: z.array(characterActionSchema).default([]),
  spells: spellsSchema.default(() => spellsSchema.parse({})),
  inventory: inventorySchema.default(() => inventorySchema.parse({})),
  featureChoices: featureChoicesSchema.default(() => featureChoicesSchema.parse({})),
  speciesChoices: speciesChoicesSchema.default(() => speciesChoicesSchema.parse({})),
  backgroundChoices: backgroundChoicesSchema.default(() => backgroundChoicesSchema.parse({})),
  /** Class skill picks from character creation (for grant sync and source labels). */
  classSkillChoices: z.array(skillKeySchema).default([]),
  /** Maps skills auto-added from feature grants to their grant key. */
  grantedSkillKeys: z.partialRecord(skillKeySchema, z.string()).optional(),
  features: z.array(featureSchema).default([]),
  })
);

export type AbilityKey = z.infer<typeof abilityKeySchema>;
export type InventoryItem = z.infer<typeof inventoryItemSchema>;
export type SkillKey = z.infer<typeof skillKeySchema>;
export type BasicInfo = z.infer<typeof basicInfoSchema>;
export type AbilityScores = z.infer<typeof abilityScoresSchema>;
export type AbilityScoreBreakdown = z.infer<typeof abilityScoreBreakdownSchema>;
export type SkillProficiency = z.infer<typeof skillProficiencySchema>;
export type CombatStats = z.infer<typeof combatStatsSchema>;
export type Attack = z.infer<typeof attackSchema>;
export type ActionCost = z.infer<typeof actionCostSchema>;
export type CharacterAction = z.infer<typeof characterActionSchema>;
export type Spell = z.infer<typeof spellSchema>;
export type Spells = z.infer<typeof spellsSchema>;
export type Inventory = z.infer<typeof inventorySchema>;
export type FeatureChoices = z.infer<typeof featureChoicesSchema>;
export type SpeciesChoices = z.infer<typeof speciesChoicesSchema>;
export type BackgroundChoices = z.infer<typeof backgroundChoicesSchema>;
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
