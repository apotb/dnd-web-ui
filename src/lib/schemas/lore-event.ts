import { z } from "zod";
import {
  DEFAULT_CAMPAIGN_DATE,
  HARPTOS_FESTIVAL_IDS,
  toAbsoluteDay,
  type HarptosDate,
} from "@/lib/dnd/harptos-calendar";

function migrateLegacyLoreEvent(input: unknown): unknown {
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

export const loreEventSchema = z.preprocess(
  migrateLegacyLoreEvent,
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

export type LoreEvent = z.infer<typeof loreEventSchema>;

function sortLoreEventsByDate(events: LoreEvent[]): LoreEvent[] {
  return [...events].sort(
    (a, b) =>
      toAbsoluteDay(loreEventToHarptosDate(b)) -
      toAbsoluteDay(loreEventToHarptosDate(a))
  );
}

export function ensureLoreEventSortOrders(events: LoreEvent[]): LoreEvent[] {
  if (events.length <= 1) return events;
  const allSameOrder = events.every(
    (event) => event.sortOrder === events[0].sortOrder
  );
  if (!allSameOrder) return events;

  return sortLoreEventsByDate(events).map((event, index) => ({
    ...event,
    sortOrder: index,
  }));
}

export function sortLoreEvents(events: LoreEvent[]): LoreEvent[] {
  return [...events].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.text.localeCompare(b.text)
  );
}

export function moveLoreEvent(
  events: LoreEvent[],
  eventId: string,
  direction: -1 | 1
): LoreEvent[] {
  const ordered = sortLoreEvents(events);
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

export function loreEventToHarptosDate(event: LoreEvent): HarptosDate {
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

export function harptosDateToLoreEventFields(
  date: HarptosDate
): Pick<LoreEvent, "year" | "month" | "day" | "festival"> {
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

export function newLoreEvent(
  campaignDate: HarptosDate,
  overrides?: Partial<LoreEvent>
): LoreEvent {
  return loreEventSchema.parse({
    ...harptosDateToLoreEventFields(campaignDate),
    ...overrides,
  });
}
