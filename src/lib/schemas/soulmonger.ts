import { z } from "zod";
import type { HarptosDate } from "@/lib/dnd/harptos-calendar";
import { calendarDateSchema } from "@/lib/schemas/world";

export const soulmongerActiveSoulSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  sortOrder: z.number().int().min(0).default(0),
});

export const soulmongerDevouredSoulSchema = z.object({
  id: z.string(),
  name: z.string().default(""),
  devouredOn: calendarDateSchema,
});

export const soulmongerDataSchema = z.object({
  active: z.array(soulmongerActiveSoulSchema).default([]),
  devoured: z.array(soulmongerDevouredSoulSchema).default([]),
});

export type SoulmongerActiveSoul = z.infer<typeof soulmongerActiveSoulSchema>;
export type SoulmongerDevouredSoul = z.infer<typeof soulmongerDevouredSoulSchema>;
export type SoulmongerData = z.infer<typeof soulmongerDataSchema>;

export type SoulmongerRollOutcome = "survived" | "devoured";

export function parseSoulmongerData(input: unknown): SoulmongerData {
  return soulmongerDataSchema.parse(input ?? {});
}

export function createDefaultSoulmongerData(
  overrides?: Partial<SoulmongerData>
): SoulmongerData {
  return soulmongerDataSchema.parse(overrides ?? {});
}

export function newSoulmongerSoul(
  name = "",
  sortOrder = 0
): SoulmongerActiveSoul {
  return soulmongerActiveSoulSchema.parse({
    id: crypto.randomUUID(),
    name,
    sortOrder,
  });
}

export function interpretSoulmongerRoll(roll: number): SoulmongerRollOutcome {
  return roll === 1 ? "devoured" : "survived";
}

export function applySoulmongerRolls(
  data: SoulmongerData,
  rolls: Record<string, number>,
  endingDate: HarptosDate
): SoulmongerData {
  const stillActive: SoulmongerActiveSoul[] = [];
  const newlyDevoured: SoulmongerDevouredSoul[] = [];

  for (const soul of data.active) {
    const roll = rolls[soul.id];
    if (roll === undefined) {
      stillActive.push(soul);
      continue;
    }

    if (interpretSoulmongerRoll(roll) === "devoured") {
      newlyDevoured.push({
        id: soul.id,
        name: soul.name,
        devouredOn: endingDate,
      });
    } else {
      stillActive.push(soul);
    }
  }

  return {
    active: stillActive,
    devoured: [...data.devoured, ...newlyDevoured],
  };
}
