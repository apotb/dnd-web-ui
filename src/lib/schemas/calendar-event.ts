import { z } from "zod";
import {
  CALENDAR_REPEAT_RULES,
  HARPTOS_FESTIVAL_IDS,
  type HarptosFestivalId,
} from "@/lib/dnd/harptos-calendar";
import type { CampaignCalendarEvent } from "@/lib/types/database";

export const calendarRepeatRuleSchema = z.enum(CALENDAR_REPEAT_RULES);

const eventTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time (HH:MM)")
  .nullable();

export const calendarEventFormSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required"),
    description: z.string().default(""),
    source: z.string().default(""),
    location: z.string().default(""),
    allDay: z.boolean().default(false),
    eventTime: eventTimeSchema.default(null),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(0).max(30),
    festival: z.enum(HARPTOS_FESTIVAL_IDS).nullable().default(null),
    year: z.number().int().min(0).nullable().default(null),
    repeatRule: calendarRepeatRuleSchema.default("none"),
  })
  .refine((data) => data.allDay || data.eventTime !== null, {
    message: "Time is required unless all-day",
    path: ["eventTime"],
  })
  .refine((data) => (data.festival ? data.day === 0 : data.day >= 1), {
    message: "Festival events use day 0; month days use 1–30",
    path: ["day"],
  });

export type CalendarEventFormValues = z.infer<typeof calendarEventFormSchema>;

export interface ParsedCalendarEvent {
  id: string;
  campaignId: string;
  title: string;
  description: string;
  source: string;
  location: string;
  allDay: boolean;
  eventTime: string | null;
  month: number;
  day: number;
  festival: HarptosFestivalId | null;
  year: number | null;
  repeatRule: z.infer<typeof calendarRepeatRuleSchema>;
  createdAt: string;
  updatedAt: string;
}

function parseFestivalFromDb(
  value: string | null | undefined
): HarptosFestivalId | null {
  if (!value) return null;
  return HARPTOS_FESTIVAL_IDS.includes(value as HarptosFestivalId)
    ? (value as HarptosFestivalId)
    : null;
}

export function parseEventTimeFromDb(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 5);
}

/** Normalize user input to HH:MM (24-hour), or null if invalid/empty. */
export function normalizeEventTimeInput(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

export function parseCalendarEventRow(
  row: CampaignCalendarEvent
): ParsedCalendarEvent {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    title: row.title,
    description: row.description,
    source: row.source,
    location: row.location ?? "",
    allDay: row.all_day ?? false,
    eventTime: parseEventTimeFromDb(row.event_time ?? null),
    month: row.month,
    day: row.day,
    festival: parseFestivalFromDb(row.festival),
    year: row.year,
    repeatRule: calendarRepeatRuleSchema.parse(row.repeat_rule),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function sortCalendarEvents(
  events: ParsedCalendarEvent[]
): ParsedCalendarEvent[] {
  return [...events].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    if (a.allDay && b.allDay) {
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    }

    const timeA = a.eventTime ?? "99:99";
    const timeB = b.eventTime ?? "99:99";
    if (timeA !== timeB) return timeA.localeCompare(timeB);

    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });
}

export function formatEventWhen(event: ParsedCalendarEvent): string {
  if (event.allDay) return "All day";
  return event.eventTime ?? "";
}

export function calendarEventToInsert(
  campaignId: string,
  values: CalendarEventFormValues,
  createdBy: string
) {
  return {
    campaign_id: campaignId,
    title: values.title.trim(),
    description: values.description.trim(),
    source: values.source.trim(),
    location: values.location.trim(),
    all_day: values.allDay,
    event_time: values.allDay ? null : values.eventTime,
    month: values.month,
    day: values.day,
    festival: values.festival,
    year: values.year,
    repeat_rule: values.repeatRule,
    created_by: createdBy,
  };
}

export function calendarEventToUpdate(values: CalendarEventFormValues) {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    source: values.source.trim(),
    location: values.location.trim(),
    all_day: values.allDay,
    event_time: values.allDay ? null : values.eventTime,
    month: values.month,
    day: values.day,
    festival: values.festival,
    year: values.year,
    repeat_rule: values.repeatRule,
  };
}
