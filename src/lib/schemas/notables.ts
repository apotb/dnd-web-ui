import { z } from "zod";
import {
  DEFAULT_CAMPAIGN_DATE,
  HARPTOS_FESTIVAL_IDS,
  toAbsoluteDay,
  type HarptosDate,
} from "@/lib/dnd/harptos-calendar";

function migrateLegacyNotableEvent(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const raw = input as Record<string, unknown>;
  if (typeof raw.year === "number") return raw;

  return {
    ...raw,
    year: DEFAULT_CAMPAIGN_DATE.year,
    month: DEFAULT_CAMPAIGN_DATE.month,
    day: DEFAULT_CAMPAIGN_DATE.day,
    festival: null,
  };
}

export const notableEventSchema = z.preprocess(
  migrateLegacyNotableEvent,
  z.object({
    id: z.string().default(() => crypto.randomUUID()),
    text: z.string().default(""),
    year: z.number().int().min(0).default(DEFAULT_CAMPAIGN_DATE.year),
    month: z.number().int().min(1).max(12).default(DEFAULT_CAMPAIGN_DATE.month),
    day: z.number().int().min(0).max(30).default(DEFAULT_CAMPAIGN_DATE.day),
    festival: z
      .enum(HARPTOS_FESTIVAL_IDS)
      .nullable()
      .default(null),
    sortOrder: z.number().int().default(0),
  })
);

export const NOTABLE_CATEGORIES = [
  { id: "port-nyanzaru", label: "Merchant Princes" },
  { id: "minor-characters", label: "Port Nyanzaru" },
] as const;

export type NotableCategory = (typeof NOTABLE_CATEGORIES)[number]["id"];

export const DEFAULT_NOTABLE_CATEGORY: NotableCategory = "minor-characters";

export const notableCategorySchema = z.enum(
  NOTABLE_CATEGORIES.map((category) => category.id) as [
    NotableCategory,
    ...NotableCategory[],
  ]
);

export const notableSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  name: z.string().default(""),
  species: z.string().default(""),
  role: z.string().default(""),
  portraitPath: z.string().default(""),
  portraitUrl: z.string().default(""),
  category: notableCategorySchema.default(DEFAULT_NOTABLE_CATEGORY),
  visibleToPlayers: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  events: z.array(notableEventSchema).default([]),
});

export const notablesDataSchema = z.object({
  notables: z.array(notableSchema).default([]),
});

export type NotableEvent = z.infer<typeof notableEventSchema>;
export type Notable = z.infer<typeof notableSchema>;
export type NotablesData = z.infer<typeof notablesDataSchema>;

export function parseNotablesData(input: unknown): NotablesData {
  const parsed = notablesDataSchema.parse(input ?? {});
  return {
    notables: parsed.notables.map((notable) => ({
      ...notable,
      events: ensureEventSortOrders(notable.events),
    })),
  };
}

function ensureEventSortOrders(events: NotableEvent[]): NotableEvent[] {
  if (events.length <= 1) return events;
  const allSameOrder = events.every(
    (event) => event.sortOrder === events[0].sortOrder
  );
  if (!allSameOrder) return events;

  return sortNotableEventsByDate(events).map((event, index) => ({
    ...event,
    sortOrder: index,
  }));
}

function sortNotableEventsByDate(events: NotableEvent[]): NotableEvent[] {
  return [...events].sort(
    (a, b) =>
      toAbsoluteDay(notableEventToHarptosDate(b)) -
      toAbsoluteDay(notableEventToHarptosDate(a))
  );
}

export function sortNotables(notables: Notable[]): Notable[] {
  return [...notables].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
  );
}

export function getNotableCategoryLabel(category: NotableCategory): string {
  return (
    NOTABLE_CATEGORIES.find((entry) => entry.id === category)?.label ?? category
  );
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
  category: NotableCategory,
  savedCategoriesById?: Map<string, NotableCategory>
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

export function sortNotableEvents(events: NotableEvent[]): NotableEvent[] {
  return [...events].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.text.localeCompare(b.text)
  );
}

export function moveNotableEvent(
  events: NotableEvent[],
  eventId: string,
  direction: -1 | 1
): NotableEvent[] {
  const ordered = sortNotableEvents(events);
  const index = ordered.findIndex((event) => event.id === eventId);
  const swapIndex = index + direction;
  if (index < 0 || swapIndex < 0 || swapIndex >= ordered.length) return events;

  const reordered = [...ordered];
  const current = reordered[index];
  const swap = reordered[swapIndex];
  reordered[index] = { ...swap, sortOrder: current.sortOrder };
  reordered[swapIndex] = { ...current, sortOrder: swap.sortOrder };
  return reordered;
}

export function notableEventToHarptosDate(event: NotableEvent): HarptosDate {
  if (event.festival) {
    return {
      year: event.year,
      month: event.month,
      day: 0,
      festival: event.festival,
    };
  }
  return {
    year: event.year,
    month: event.month,
    day: event.day,
  };
}

export function harptosDateToNotableEventFields(
  date: HarptosDate
): Pick<NotableEvent, "year" | "month" | "day" | "festival"> {
  if (date.festival) {
    return {
      year: date.year,
      month: date.month,
      day: 0,
      festival: date.festival,
    };
  }
  return {
    year: date.year,
    month: date.month,
    day: date.day,
    festival: null,
  };
}

export function newNotableEvent(
  campaignDate: HarptosDate,
  overrides?: Partial<NotableEvent>
): NotableEvent {
  return notableEventSchema.parse({
    ...harptosDateToNotableEventFields(campaignDate),
    ...overrides,
  });
}

export function newNotable(
  overrides?: Partial<Notable>,
  sortOrder = 0
): Notable {
  return notableSchema.parse({ sortOrder, ...overrides });
}

export function createSeedNotablesData(): NotablesData {
  return notablesDataSchema.parse({
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
