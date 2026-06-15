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

export const HARPTOS_FESTIVAL_IDS = [
  "midwinter",
  "greengrass",
  "midsummer",
  "shieldmeet",
  "highharvestide",
  "feast-of-the-moon",
] as const;

export type HarptosFestivalId = (typeof HARPTOS_FESTIVAL_IDS)[number];

export interface HarptosFestival {
  id: HarptosFestivalId;
  name: string;
  afterMonth: number;
  /** Order when multiple festivals follow the same month. */
  order?: number;
  leapYearOnly?: boolean;
}

export const HARPTOS_FESTIVALS: HarptosFestival[] = [
  { id: "midwinter", name: "Midwinter", afterMonth: 1 },
  { id: "greengrass", name: "Greengrass", afterMonth: 4 },
  { id: "midsummer", name: "Midsummer", afterMonth: 7, order: 0 },
  { id: "shieldmeet", name: "Shieldmeet", afterMonth: 7, order: 1, leapYearOnly: true },
  { id: "highharvestide", name: "Highharvestide", afterMonth: 9 },
  { id: "feast-of-the-moon", name: "Feast of the Moon", afterMonth: 11 },
];

export interface HarptosDate {
  year: number;
  month: number;
  /** 1–30 for month days; 0 when `festival` is set. */
  day: number;
  festival?: HarptosFestivalId | null;
}

/** Party begins 17 Kythorn, 1490 DR. */
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

const FESTIVAL_BY_ID = new Map(HARPTOS_FESTIVALS.map((f) => [f.id, f] as const));

/** Shieldmeet falls after Midsummer every four years (Faerûn leap day). */
export function isShieldmeetYear(year: number): boolean {
  return year % 4 === 0;
}

export function daysInYear(year: number): number {
  return 365 + (isShieldmeetYear(year) ? 1 : 0);
}

export function getFestivalsAfterMonth(month: number, year: number): HarptosFestival[] {
  return HARPTOS_FESTIVALS.filter(
    (festival) =>
      festival.afterMonth === month &&
      (!festival.leapYearOnly || isShieldmeetYear(year))
  ).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function getFestivalById(id: HarptosFestivalId): HarptosFestival | undefined {
  return FESTIVAL_BY_ID.get(id);
}

export function isFestivalDate(date: HarptosDate): boolean {
  return date.festival != null;
}

export function festivalOccursInYear(
  festivalId: HarptosFestivalId,
  year: number
): boolean {
  const festival = getFestivalById(festivalId);
  if (!festival) return false;
  if (festival.leapYearOnly && !isShieldmeetYear(year)) return false;
  return true;
}

export function festivalDate(
  year: number,
  festivalId: HarptosFestivalId
): HarptosDate {
  const festival = getFestivalById(festivalId);
  if (!festival) {
    throw new Error(`Unknown festival: ${festivalId}`);
  }
  if (festival.leapYearOnly && !isShieldmeetYear(year)) {
    throw new Error(`Festival ${festivalId} does not occur in ${year} DR`);
  }
  return {
    year,
    month: festival.afterMonth,
    day: 0,
    festival: festivalId,
  };
}

function* iterateHarptosYear(year: number): Generator<HarptosDate> {
  for (let month = 1; month <= 12; month++) {
    for (let day = 1; day <= 30; day++) {
      yield { year, month, day };
    }
    for (const festival of getFestivalsAfterMonth(month, year)) {
      yield festivalDate(year, festival.id);
    }
  }
}

/** 1-based index within the Harptos year (365 or 366 days). */
export function toDayOfYear(date: HarptosDate): number {
  let dayOfYear = 1;
  for (const candidate of iterateHarptosYear(date.year)) {
    if (sameHarptosDate(candidate, date)) {
      return dayOfYear;
    }
    dayOfYear += 1;
  }
  return 1;
}

export function toAbsoluteDay(date: HarptosDate): number {
  let absolute = 0;
  for (let year = 0; year < date.year; year++) {
    absolute += daysInYear(year);
  }
  return absolute + toDayOfYear(date) - 1;
}

export function fromAbsoluteDay(abs: number): HarptosDate {
  let remaining = abs;
  let year = 0;

  while (remaining >= daysInYear(year)) {
    remaining -= daysInYear(year);
    year += 1;
  }

  let dayOfYear = remaining + 1;
  for (const date of iterateHarptosYear(year)) {
    if (dayOfYear === 1) {
      return date;
    }
    dayOfYear -= 1;
  }

  return { year, month: 12, day: 30 };
}

/**
 * 0-based count of regular month days since the start of the year.
 * Festivals are excluded so tenday cycles stay aligned across months.
 */
export function toRegularDayIndex(date: HarptosDate): number | null {
  if (date.festival) return null;

  let index = 0;
  for (let month = 1; month < date.month; month++) {
    index += 30;
  }
  return index + (date.day - 1);
}

export function addDays(date: HarptosDate, days: number): HarptosDate {
  return fromAbsoluteDay(toAbsoluteDay(date) + days);
}

export function addMonths(
  date: Pick<HarptosDate, "year" | "month">,
  months: number
): Pick<HarptosDate, "year" | "month"> {
  const totalMonths = date.year * 12 + (date.month - 1) + months;
  const year = Math.floor(totalMonths / 12);
  const month = (totalMonths % 12) + 1;
  return { year, month };
}

export function sameHarptosDate(a: HarptosDate, b: HarptosDate): boolean {
  if (a.year !== b.year) return false;
  if (a.festival || b.festival) {
    return a.festival === b.festival && a.month === b.month;
  }
  return a.month === b.month && a.day === b.day;
}

export function getTendayInfo(day: number): { tenday: number; dayInTenday: number } {
  const tenday = Math.floor((day - 1) / 10) + 1;
  const dayInTenday = ((day - 1) % 10) + 1;
  return { tenday, dayInTenday };
}

const TENDAY_ORDINALS = ["1st", "2nd", "3rd"] as const;

export function formatHarptosDate(date: HarptosDate): string {
  if (date.festival) {
    const festival = getFestivalById(date.festival);
    const name = festival?.name ?? date.festival;
    return `${name}, ${date.year} DR`;
  }

  const monthName = HARPTOS_MONTHS[date.month - 1];
  const { tenday, dayInTenday } = getTendayInfo(date.day);
  const tendayLabel = TENDAY_ORDINALS[tenday - 1] ?? `${tenday}th`;
  return `${date.day} ${monthName}, ${date.year} DR · ${tendayLabel} tenday, day ${dayInTenday}`;
}

export function formatHarptosDateShort(date: HarptosDate): string {
  if (date.festival) {
    const festival = getFestivalById(date.festival);
    return `${festival?.name ?? date.festival}, ${date.year} DR`;
  }
  return `${date.day} ${HARPTOS_MONTHS[date.month - 1]}, ${date.year} DR`;
}

export interface CalendarEventLike {
  month: number;
  day: number;
  festival?: HarptosFestivalId | null;
  year: number | null;
  repeatRule: CalendarRepeatRule;
}

export function eventAnchorDate(
  event: CalendarEventLike,
  fallbackYear: number
): HarptosDate {
  if (event.festival) {
    return festivalDate(event.year ?? fallbackYear, event.festival);
  }
  return {
    year: event.year ?? fallbackYear,
    month: event.month,
    day: event.day,
  };
}

/** Fixed start date for repeating events (does not slide with the viewed year). */
function repeatingEventAnchor(event: CalendarEventLike): HarptosDate {
  const anchorYear = event.year ?? 0;
  if (event.festival) {
    return festivalDate(anchorYear, event.festival);
  }
  return {
    year: anchorYear,
    month: event.month,
    day: event.day,
  };
}

function toAbsoluteRegularDay(date: HarptosDate): number | null {
  const index = toRegularDayIndex(date);
  if (index === null) return null;
  return date.year * 360 + index;
}

function matchesCalendarDay(
  event: CalendarEventLike,
  date: HarptosDate
): boolean {
  if (event.festival) {
    if (!festivalOccursInYear(event.festival, date.year)) return false;
    return date.festival === event.festival && event.month === date.month;
  }
  return !date.festival && event.month === date.month && event.day === date.day;
}

export function eventOccursOnDate(
  event: CalendarEventLike,
  date: HarptosDate
): boolean {
  if (event.repeatRule === "none") {
    const anchorYear = event.year ?? date.year;
    return anchorYear === date.year && matchesCalendarDay(event, date);
  }

  switch (event.repeatRule) {
    case "daily":
      return toAbsoluteDay(date) >= toAbsoluteDay(repeatingEventAnchor(event));
    case "tenday": {
      if (date.festival) return false;
      const anchor = repeatingEventAnchor(event);
      if (anchor.festival) return false;
      const anchorRegularAbs = toAbsoluteRegularDay(anchor);
      const targetRegularAbs = toAbsoluteRegularDay(date);
      if (anchorRegularAbs === null || targetRegularAbs === null) return false;
      if (targetRegularAbs < anchorRegularAbs) return false;
      return (targetRegularAbs - anchorRegularAbs) % 10 === 0;
    }
    case "monthly": {
      if (event.festival || date.festival) return false;
      if (event.day !== date.day) return false;
      if (event.year != null) {
        if (date.year < event.year) return false;
        if (date.year === event.year) {
          return toAbsoluteDay(date) >= toAbsoluteDay(repeatingEventAnchor(event));
        }
      }
      return true;
    }
    case "yearly":
      if (event.year != null && date.year < event.year) return false;
      return matchesCalendarDay(event, date);
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
