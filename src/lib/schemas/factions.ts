import { z } from "zod";
import {
  ensureCategories,
  loreCategorySchema,
  sortCategories,
  type LoreCategory,
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
  return {
    categories: sortCategories(parsed.categories),
    factions: parsed.factions.map((faction) => ({
      ...faction,
      events: ensureLoreEventSortOrders(faction.events),
    })),
  };
}

export function sortFactions(factions: Faction[]): Faction[] {
  return [...factions].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
  );
}

export function filterFactionsByCategory(
  factions: Faction[],
  category: string,
  savedCategoriesById?: Map<string, string>
): Faction[] {
  return sortFactions(
    factions.filter((faction) => {
      const tabCategory = savedCategoriesById?.get(faction.id) ?? faction.category;
      return tabCategory === category;
    })
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

export function getFactionCategoryLabel(
  categories: LoreCategory[],
  categoryId: string
): string {
  return categories.find((entry) => entry.id === categoryId)?.label ?? categoryId;
}
