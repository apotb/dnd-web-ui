import { z } from "zod";
import { DEFAULT_CAMPAIGN_DATE } from "@/lib/dnd/harptos-calendar";

export const calendarDateSchema = z.object({
  year: z.number().int().min(0).default(DEFAULT_CAMPAIGN_DATE.year),
  month: z.number().int().min(1).max(12).default(DEFAULT_CAMPAIGN_DATE.month),
  day: z.number().int().min(1).max(30).default(DEFAULT_CAMPAIGN_DATE.day),
});

export const worldDataSchema = z.object({
  calendar: calendarDateSchema.default(DEFAULT_CAMPAIGN_DATE),
});

export type CalendarDate = z.infer<typeof calendarDateSchema>;
export type WorldData = z.infer<typeof worldDataSchema>;

export function parseWorldData(input: unknown): WorldData {
  return worldDataSchema.parse(input ?? {});
}

export function getCampaignCalendarDate(worldData: WorldData): CalendarDate {
  return worldData.calendar;
}
