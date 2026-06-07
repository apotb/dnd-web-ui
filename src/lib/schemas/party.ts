import { z } from "zod";

export const partyAnimalSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  name: z.string().default(""),
  type: z.string().default(""),
  caretakerCharacterId: z.string().default(""),
  carryCapacityLb: z.number().min(0).default(0),
  notes: z.string().default(""),
});

export const partyItemSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  name: z.string().default(""),
  quantity: z.number().int().min(0).default(1),
  weightLb: z.number().min(0).default(0),
  animalId: z.string().default(""),
  notes: z.string().default(""),
});

export const partyDataSchema = z.object({
  animals: z.array(partyAnimalSchema).default([]),
  items: z.array(partyItemSchema).default([]),
  notes: z.string().default(""),
});

export type PartyAnimal = z.infer<typeof partyAnimalSchema>;
export type PartyItem = z.infer<typeof partyItemSchema>;
export type PartyData = z.infer<typeof partyDataSchema>;

export function parsePartyData(input: unknown): PartyData {
  return partyDataSchema.parse(input ?? {});
}

export function createDefaultPartyData(
  overrides?: Partial<PartyData>
): PartyData {
  return partyDataSchema.parse(overrides ?? {});
}
