import { z } from "zod";
import { enemyDataSchema } from "@/lib/schemas/enemy";

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

export const partyAllySchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  name: z.string().default(""),
  /** Provenance only — ally stats are copied, not live-linked. */
  sourceEnemySlug: z.string().optional(),
  /** Catalog creature name at creation (e.g. Thug, Scout). */
  sourceEnemyName: z.string().optional(),
  /** PHB species display name (e.g. Human, Elf (High)). */
  race: z.string().default(""),
  data: enemyDataSchema,
  currentHp: z.number().int().min(0).default(1),
  conditions: z.array(z.string()).default([]),
  notes: z.string().default(""),
});

export const partyDataSchema = z.object({
  animals: z.array(partyAnimalSchema).default([]),
  items: z.array(partyItemSchema).default([]),
  allies: z.array(partyAllySchema).default([]),
  notes: z.string().default(""),
});

export type PartyAnimal = z.infer<typeof partyAnimalSchema>;
export type PartyItem = z.infer<typeof partyItemSchema>;
export type PartyAlly = z.infer<typeof partyAllySchema>;
export type PartyData = z.infer<typeof partyDataSchema>;

export function parsePartyData(input: unknown): PartyData {
  return partyDataSchema.parse(input ?? {});
}

/** Union roster entries by id; incoming wins on conflict. */
export function mergePartyData(cached: PartyData, incoming: PartyData): PartyData {
  const allyById = new Map(cached.allies.map((ally) => [ally.id, ally]));
  for (const ally of incoming.allies) {
    allyById.set(ally.id, ally);
  }

  const animalById = new Map(cached.animals.map((animal) => [animal.id, animal]));
  for (const animal of incoming.animals) {
    animalById.set(animal.id, animal);
  }

  const itemById = new Map(cached.items.map((item) => [item.id, item]));
  for (const item of incoming.items) {
    itemById.set(item.id, item);
  }

  return parsePartyData({
    notes: incoming.notes || cached.notes,
    allies: [...allyById.values()],
    animals: [...animalById.values()],
    items: [...itemById.values()],
  });
}

export function createDefaultPartyData(
  overrides?: Partial<PartyData>
): PartyData {
  return partyDataSchema.parse(overrides ?? {});
}
