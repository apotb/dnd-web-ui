import { z } from "zod";
import type { HarptosDate } from "@/lib/dnd/harptos-calendar";
import {
  DEFAULT_NOTABLE_CATEGORIES,
  DEFAULT_NOTABLE_CATEGORY_ID,
  ensureCategories,
  getCategoryLabel,
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
  harptosDateToLoreEventFields,
  loreEventToHarptosDate,
  type LoreEvent,
} from "@/lib/schemas/lore-event";

export {
  DEFAULT_NOTABLE_CATEGORIES as NOTABLE_CATEGORIES,
  DEFAULT_NOTABLE_CATEGORY_ID as DEFAULT_NOTABLE_CATEGORY,
};
export type NotableCategory = string;

export const notableEventSchema = loreEventSchema;
export type NotableEvent = LoreEvent;

export const notableSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  name: z.string().default(""),
  species: z.string().default(""),
  role: z.string().default(""),
  portraitPath: z.string().default(""),
  portraitUrl: z.string().default(""),
  category: z.string().default(DEFAULT_NOTABLE_CATEGORY_ID),
  visibleToPlayers: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  events: z.array(notableEventSchema).default([]),
});

export const notablesDataSchema = z.object({
  categories: z.array(loreCategorySchema).default([]),
  notables: z.array(notableSchema).default([]),
});

export type Notable = z.infer<typeof notableSchema>;
export type NotablesData = z.infer<typeof notablesDataSchema>;

export function parseNotablesData(input: unknown): NotablesData {
  const categories = ensureCategories(input, DEFAULT_NOTABLE_CATEGORIES);
  const parsed = notablesDataSchema.parse({
    ...(typeof input === "object" && input !== null ? input : {}),
    categories,
  });
  return {
    categories: sortCategories(parsed.categories),
    notables: parsed.notables.map((notable) => ({
      ...notable,
      events: ensureLoreEventSortOrders(notable.events),
    })),
  };
}

export function sortNotables(notables: Notable[]): Notable[] {
  return [...notables].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
  );
}

export function getNotableCategoryLabel(
  categories: LoreCategory[],
  category: string
): string {
  return getCategoryLabel(categories, category);
}

export function formatNotableNameLine(notable: Pick<Notable, "name" | "species">): string {
  const name = notable.name.trim();
  const species = notable.species.trim();
  if (!name) return species;
  if (!species) return name;
  return `${name} · ${species}`;
}

export function filterNotablesByCategory(
  notables: Notable[],
  category: string,
  savedCategoriesById?: Map<string, string>
): Notable[] {
  return sortNotables(
    notables.filter((notable) => {
      const tabCategory = savedCategoriesById?.get(notable.id) ?? notable.category;
      return tabCategory === category;
    })
  );
}

export function filterNotablesForViewer(
  notables: Notable[],
  isDm: boolean
): Notable[] {
  if (isDm) return notables;
  return notables.filter((notable) => notable.visibleToPlayers);
}

export const sortNotableEvents = sortLoreEvents;
export const moveNotableEvent = moveLoreEvent;
export const notableEventToHarptosDate = loreEventToHarptosDate;

export function harptosDateToNotableEventFields(
  date: HarptosDate
): Pick<NotableEvent, "year" | "month" | "day" | "festival"> {
  return harptosDateToLoreEventFields(date);
}

export function newNotableEvent(
  campaignDate: HarptosDate,
  overrides?: Partial<NotableEvent>
): NotableEvent {
  return newLoreEvent(campaignDate, overrides);
}

export function newNotable(
  overrides?: Partial<Notable>,
  sortOrder = 0
): Notable {
  return notableSchema.parse({ sortOrder, ...overrides });
}

export function createSeedNotablesData(): NotablesData {
  return parseNotablesData({
    notables: [
      {
        id: "wakanga-otamu",
        name: "Wakanga O'Tamu",
        role: "Mentioned by Kwalu",
        portraitUrl:
          "https://static.wikia.nocookie.net/forgottenrealms/images/5/50/Merchant_Prince_Wakanga_O%27tamu.jpg/revision/latest?cb=20180204120606",
        sortOrder: 0,
      },
      {
        id: "syndra-silvane",
        name: "Syndra Silvane",
        role: "Historian of the dark arts, recently diseased",
        portraitUrl:
          "https://static.wikia.nocookie.net/withweapons/images/9/9c/Syndra.jpg/revision/latest?cb=20200401000914",
        sortOrder: 1,
      },
      {
        id: "grandfather-zitembe",
        name: "Grandfather Zitembe",
        role: "Head priest of Temple of Savras",
        portraitUrl:
          "https://static.wikia.nocookie.net/withweapons/images/0/0e/Highfather_Zitembe.jpg/revision/latest?cb=20200413032725",
        sortOrder: 2,
      },
      {
        id: "mara-tonn",
        name: "Mara Tonn",
        role: "Syndra Silvane's old friend",
        sortOrder: 3,
      },
      {
        id: "daro-venn",
        name: "Daro Venn",
        role: "Attempted jewel thief",
        sortOrder: 4,
      },
      {
        id: "kwalu",
        name: "Kwalu",
        role: "Head of Silvane estate security",
        sortOrder: 5,
      },
      {
        id: "jeremiah",
        name: "Jeremiah",
        role: "Bartender",
        sortOrder: 6,
      },
    ],
  });
}
