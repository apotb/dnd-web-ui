import { z } from "zod";

export const combatantTypeSchema = z.enum(["player", "npc", "monster"]);

export const combatantDataSchema = z.object({
  name: z.string().default(""),
  type: combatantTypeSchema.default("monster"),
  ac: z.number().int().min(0).default(10),
  maxHp: z.number().int().min(0).default(1),
  currentHp: z.number().int().default(1),
  tempHp: z.number().int().min(0).default(0),
  conditions: z.array(z.string()).default([]),
  concentration: z
    .object({
      active: z.boolean().default(false),
      spell: z.string().default(""),
    })
    .default({ active: false, spell: "" }),
  dmNotes: z.string().default(""),
});

export const encounterSchema = z.object({
  id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  name: z.string(),
  round: z.number().int().min(0),
  current_turn_index: z.number().int().min(0),
  active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const encounterCombatantSchema = z.object({
  id: z.string().uuid(),
  encounter_id: z.string().uuid(),
  character_id: z.string().uuid().nullable(),
  data: combatantDataSchema,
  initiative: z.number().int(),
  sort_order: z.number().int(),
  visible_to_players: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CombatantType = z.infer<typeof combatantTypeSchema>;
export type CombatantData = z.infer<typeof combatantDataSchema>;
export type Encounter = z.infer<typeof encounterSchema>;
export type EncounterCombatant = z.infer<typeof encounterCombatantSchema>;

export function createDefaultCombatantData(
  overrides?: Partial<CombatantData>
): CombatantData {
  return combatantDataSchema.parse(overrides ?? {});
}

/** Vague health labels for player view of monsters/NPCs. */
export type HealthLabel =
  | "Healthy"
  | "Injured"
  | "Bloodied"
  | "Near Death"
  | "Defeated";

export function getHealthLabel(
  currentHp: number,
  maxHp: number
): HealthLabel {
  if (currentHp <= 0) return "Defeated";
  if (maxHp <= 0) return "Healthy";
  const ratio = currentHp / maxHp;
  if (ratio > 0.75) return "Healthy";
  if (ratio > 0.5) return "Injured";
  if (ratio > 0.25) return "Bloodied";
  return "Near Death";
}

/** Strip DM-only fields from combatant data for players. */
export function stripDmNotesFromCombatantData(
  data: CombatantData
): CombatantData {
  return { ...data, dmNotes: "" };
}

/** Sort combatants by initiative (desc), then sort_order. */
export function sortCombatantsByInitiative<
  T extends { initiative: number; sort_order: number }
>(combatants: T[]): T[] {
  return [...combatants].sort((a, b) => {
    if (b.initiative !== a.initiative) return b.initiative - a.initiative;
    return a.sort_order - b.sort_order;
  });
}

export const COMMON_CONDITIONS = [
  "Blinded",
  "Charmed",
  "Deafened",
  "Exhaustion",
  "Frightened",
  "Grappled",
  "Incapacitated",
  "Invisible",
  "Paralyzed",
  "Petrified",
  "Poisoned",
  "Prone",
  "Restrained",
  "Stunned",
  "Unconscious",
] as const;
