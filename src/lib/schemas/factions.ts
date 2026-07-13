import { z } from "zod";
import {
  ensureCategories,
  loreCategorySchema,
  sortCategories,
} from "@/lib/schemas/lore-category";
import {
  ensureLoreEventSortOrders,
  loreEventSchema,
  moveLoreEvent,
  newLoreEvent,
  sortLoreEvents,
  type LoreEvent,
} from "@/lib/schemas/lore-event";
import {
  filterNotablesForViewer,
  formatNotableNameLine,
  type Notable,
} from "@/lib/schemas/notables";
import type { HarptosDate } from "@/lib/dnd/harptos-calendar";

export const factionEventSchema = loreEventSchema;
export type FactionEvent = LoreEvent;

export const factionSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  name: z.string().default(""),
  type: z.string().default(""),
  goals: z.string().default(""),
  category: z.string().default(""),
  visibleToPlayers: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  events: z.array(factionEventSchema).default([]),
  memberNotableIds: z.array(z.string()).default([]),
});

export const factionsDataSchema = z.object({
  categories: z.array(loreCategorySchema).default([]),
  factions: z.array(factionSchema).default([]),
});

export type Faction = z.infer<typeof factionSchema>;
export type FactionsData = z.infer<typeof factionsDataSchema>;

export function parseFactionsData(input: unknown): FactionsData {
  const categories = ensureCategories(input, []);
  const parsed = factionsDataSchema.parse({
    ...(typeof input === "object" && input !== null ? input : {}),
    categories,
  });
  return normalizeFactionsData({
    categories: parsed.categories,
    factions: parsed.factions.map((faction) => ({
      ...faction,
      events: ensureLoreEventSortOrders(faction.events),
    })),
  });
}

/** Flatten legacy categorized factions into one ordered list. */
export function normalizeFactionsData(data: FactionsData): FactionsData {
  const categoryOrder = new Map(
    sortCategories(data.categories).map((category, index) => [category.id, index])
  );
  const factions = sortFactions(data.factions)
    .sort((a, b) => {
      const categoryA = categoryOrder.get(a.category) ?? 0;
      const categoryB = categoryOrder.get(b.category) ?? 0;
      if (categoryA !== categoryB) return categoryA - categoryB;
      return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
    })
    .map((faction, index) => ({
      ...faction,
      category: "",
      sortOrder: index,
    }));
  return { categories: [], factions };
}

export function sortFactions(factions: Faction[]): Faction[] {
  return [...factions].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
  );
}

export function filterFactionsForViewer(
  factions: Faction[],
  isDm: boolean
): Faction[] {
  if (isDm) return factions;
  return factions.filter((faction) => faction.visibleToPlayers);
}

export const sortFactionEvents = sortLoreEvents;
export const moveFactionEvent = moveLoreEvent;

export function newFactionEvent(
  campaignDate: HarptosDate,
  overrides?: Partial<FactionEvent>
): FactionEvent {
  return newLoreEvent(campaignDate, overrides);
}

export function newFaction(
  overrides?: Partial<Faction>,
  sortOrder = 0
): Faction {
  return factionSchema.parse({ sortOrder, ...overrides });
}

export function filterFactionMembersForViewer(
  memberNotableIds: string[],
  notables: Notable[],
  isDm: boolean
): Notable[] {
  const visibleNotables = filterNotablesForViewer(notables, isDm);
  const visibleIds = new Set(visibleNotables.map((notable) => notable.id));
  return memberNotableIds
    .map((id) => visibleNotables.find((notable) => notable.id === id))
    .filter((notable): notable is Notable => notable !== undefined && visibleIds.has(notable.id));
}

export function formatFactionMemberLine(notable: Notable): string {
  return formatNotableNameLine(notable) || "Unnamed notable";
}
