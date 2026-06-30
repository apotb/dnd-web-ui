import { z } from "zod";
import { blockedCellSchema } from "@/lib/schemas/combat-state";

export const savedEncounterEnemySchema = z.object({
  enemySlug: z.string(),
  displayName: z.string().optional(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(1).default(1),
  height: z.number().int().min(1).default(1),
});

export const savedEncounterMarkerSchema = z.object({
  name: z.string().default(""),
  tooltip: z.string().default(""),
  portraitPath: z.string().nullable().default(null),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(1).default(1),
  height: z.number().int().min(1).default(1),
});

export const savedEncounterCharacterSlotSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().min(1).default(1),
  height: z.number().int().min(1).default(1),
});

export const savedEncounterDataSchema = z.object({
  enemies: z.array(savedEncounterEnemySchema).default([]),
  markers: z.array(savedEncounterMarkerSchema).default([]),
  characterSlots: z.array(savedEncounterCharacterSlotSchema).default([]),
});

export type SavedEncounterEnemy = z.infer<typeof savedEncounterEnemySchema>;
export type SavedEncounterMarker = z.infer<typeof savedEncounterMarkerSchema>;
export type SavedEncounterCharacterSlot = z.infer<typeof savedEncounterCharacterSlotSchema>;
export type SavedEncounterData = z.infer<typeof savedEncounterDataSchema>;

export function parseSavedEncounterData(input: unknown): SavedEncounterData {
  return savedEncounterDataSchema.parse(input ?? {});
}

export function parseSavedEncounterBlockedCells(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .map((cell) => blockedCellSchema.safeParse(cell))
    .filter((result) => result.success)
    .map((result) => result.data);
}
