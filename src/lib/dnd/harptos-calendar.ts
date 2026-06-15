export const HARPTOS_MONTHS = [
  "Hammer",
  "Alturiak",
  "Ches",
  "Tarsakh",
  "Mirtul",
  "Kythorn",
  "Flamerule",
  "Eleasis",
  "Eleint",
  "Marpenoth",
  "Uktar",
  "Nightal",
] as const;

export type HarptosMonthName = (typeof HARPTOS_MONTHS)[number];

export interface HarptosDate {
  year: number;
  month: number;
  day: number;
}

/** Party begins 7 Kythorn (7th day of the 2nd tenday), 1490 DR. */
export const DEFAULT_CAMPAIGN_DATE: HarptosDate = {
  year: 1490,
  month: 6,
  day: 17,
};

export const CALENDAR_REPEAT_RULES = [
  "none",
  "daily",
  "tenday",
  "monthly",
  "yearly",
] as const;

export type CalendarRepeatRule = (typeof CALENDAR_REPEAT_RULES)[number];

export const CALENDAR_REPEAT_LABELS: Record<CalendarRepeatRule, string> = {
  none: "Once",
  daily: "Daily",
  tenday: "Every tenday",
  monthly: "Monthly",
  yearly: "Yearly",
};

export function toAbsoluteDay(date: HarptosDate): number {
  return date.year * 360 + (date.month - 1) * 30 + (date.day - 1);
}

export function fromAbsoluteDay(abs: number): HarptosDate {
  const year = Math.floor(abs / 360);
  const dayOfYear = ((abs % 360) + 360) % 360;
  const month = Math.floor(dayOfYear / 30) + 1;
  const day = (dayOfYear % 30) + 1;
  return { year, month, day };
}

export function addDays(date: HarptosDate, days: number): HarptosDate {
  return fromAbsoluteDay(toAbsoluteDay(date) + days);
}

export function addMonths(
  date: Pick<HarptosDate, "year" | "month">,
  months: number
): Pick<HarptosDate, "year" | "month"> {
  const anchor: HarptosDate = { year: date.year, month: date.month, day: 1 };
  const shifted = fromAbsoluteDay(toAbsoluteDay(anchor) + months * 30);
  return { year: shifted.year, month: shifted.month };
}

export function sameHarptosDate(a: HarptosDate, b: HarptosDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function getTendayInfo(day: number): { tenday: number; dayInTenday: number } {
  const tenday = Math.floor((day - 1) / 10) + 1;
  const dayInTenday = ((day - 1) % 10) + 1;
  return { tenday, dayInTenday };
}

const TENDAY_ORDINALS = ["1st", "2nd", "3rd"] as const;

export function formatHarptosDate(date: HarptosDate): string {
  const monthName = HARPTOS_MONTHS[date.month - 1];
  const { tenday, dayInTenday } = getTendayInfo(date.day);
  const tendayLabel = TENDAY_ORDINALS[tenday - 1] ?? `${tenday}th`;
  return `${date.day} ${monthName}, ${date.year} DR · ${tendayLabel} tenday, day ${dayInTenday}`;
}

export function formatHarptosDateShort(date: HarptosDate): string {
  return `${date.day} ${HARPTOS_MONTHS[date.month - 1]}, ${date.year} DR`;
}

export interface CalendarEventLike {
  month: number;
  day: number;
  year: number | null;
  repeatRule: CalendarRepeatRule;
}

export function eventAnchorDate(event: CalendarEventLike, fallbackYear: number): HarptosDate {
  return {
    year: event.year ?? fallbackYear,
    month: event.month,
    day: event.day,
  };
}

export function eventOccursOnDate(
  event: CalendarEventLike,
  date: HarptosDate
): boolean {
  if (event.repeatRule === "none") {
    const anchorYear = event.year ?? date.year;
    return (
      event.month === date.month &&
      event.day === date.day &&
      anchorYear === date.year
    );
  }

  const anchor = eventAnchorDate(event, date.year);
  const anchorAbs = toAbsoluteDay(anchor);
  const targetAbs = toAbsoluteDay(date);
  if (targetAbs < anchorAbs) return false;

  switch (event.repeatRule) {
    case "daily":
      return true;
    case "tenday":
      return (targetAbs - anchorAbs) % 10 === 0;
    case "monthly":
      return event.day === date.day;
    case "yearly":
      return event.month === date.month && event.day === date.day;
    default:
      return false;
  }
}

export function getEventsOnDate<T extends CalendarEventLike>(
  events: T[],
  date: HarptosDate
): T[] {
  return events.filter((event) => eventOccursOnDate(event, date));
}

export function getUpcomingEventDays<T extends CalendarEventLike>(
  events: T[],
  fromDate: HarptosDate,
  dayCount: number
): Array<{ date: HarptosDate; events: T[] }> {
  const days: Array<{ date: HarptosDate; events: T[] }> = [];

  for (let offset = 0; offset < dayCount; offset++) {
    const date = addDays(fromDate, offset);
    const onDay = getEventsOnDate(events, date);
    if (onDay.length > 0) {
      days.push({ date, events: onDay });
    }
  }

  return days;
}
