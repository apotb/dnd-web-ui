"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CALENDAR_REPEAT_LABELS,
  CALENDAR_REPEAT_RULES,
  HARPTOS_MONTHS,
  addDays,
  addMonths,
  festivalDate,
  formatHarptosDate,
  getEventsOnDate,
  getFestivalById,
  getFestivalsAfterMonth,
  getTendayInfo,
  sameHarptosDate,
  type HarptosDate,
  type HarptosFestivalId,
} from "@/lib/dnd/harptos-calendar";
import { useRealtimeCalendarEvents } from "@/lib/hooks/use-realtime-calendar-events";
import { useRealtimeWorldData } from "@/lib/hooks/use-realtime-world-data";
import { useShowDmUi } from "@/components/layout/dm-view-provider";
import {
  calendarEventFormSchema,
  calendarEventToInsert,
  calendarEventToUpdate,
  formatEventWhen,
  normalizeEventTimeInput,
  sortCalendarEvents,
  type CalendarEventFormValues,
  type ParsedCalendarEvent,
} from "@/lib/schemas/calendar-event";
import {
  getCampaignCalendarDate,
  type WorldData,
} from "@/lib/schemas/world";

interface HarptosCalendarProps {
  campaignId: string;
  initialWorldData: WorldData;
  initialEvents: ParsedCalendarEvent[];
  isDm: boolean;
  userId: string | null;
  canManageEvents: boolean;
}

const TENDAY_LABELS = ["1st tenday", "2nd tenday", "3rd tenday"] as const;

function emptyEventForm(date: HarptosDate): CalendarEventFormValues {
  return {
    title: "",
    description: "",
    source: "",
    location: "",
    allDay: false,
    eventTime: "12:00",
    month: date.month,
    day: date.festival ? 0 : date.day,
    festival: date.festival ?? null,
    year: date.year,
    repeatRule: "none",
  };
}

function monthViewLabel(year: number, month: number): string {
  return `${HARPTOS_MONTHS[month - 1]} ${year} DR`;
}

export function HarptosCalendar({
  campaignId,
  initialWorldData,
  initialEvents,
  isDm,
  userId,
  canManageEvents,
}: HarptosCalendarProps) {
  const showDmUi = useShowDmUi(isDm);
  const worldData = useRealtimeWorldData(campaignId, initialWorldData);
  const events = useRealtimeCalendarEvents(campaignId, initialEvents);
  const today = getCampaignCalendarDate(worldData);

  const [viewYear, setViewYear] = useState(today.year);
  const [viewMonth, setViewMonth] = useState(today.month);
  const [selectedDate, setSelectedDate] = useState<HarptosDate>(today);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CalendarEventFormValues>(() =>
    emptyEventForm(today)
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDate(today);
  }, [today.year, today.month, today.day, today.festival]);

  const monthFestivals = useMemo(
    () => getFestivalsAfterMonth(viewMonth, viewYear),
    [viewMonth, viewYear]
  );

  const selectedEvents = useMemo(
    () => sortCalendarEvents(getEventsOnDate(events, selectedDate)),
    [events, selectedDate]
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<number, ParsedCalendarEvent[]>();
    for (let day = 1; day <= 30; day++) {
      const date: HarptosDate = { year: viewYear, month: viewMonth, day };
      const dayEvents = getEventsOnDate(events, date);
      if (dayEvents.length > 0) map.set(day, dayEvents);
    }
    return map;
  }, [events, viewYear, viewMonth]);

  const festivalEventsById = useMemo(() => {
    const map = new Map<HarptosFestivalId, ParsedCalendarEvent[]>();
    for (const festival of monthFestivals) {
      map.set(
        festival.id,
        getEventsOnDate(events, festivalDate(viewYear, festival.id))
      );
    }
    return map;
  }, [events, monthFestivals, viewYear]);

  function resetForm() {
    setForm(emptyEventForm(selectedDate));
    setEditingId(null);
    setShowForm(false);
    setMessage(null);
  }

  function startEdit(event: ParsedCalendarEvent) {
    setEditingId(event.id);
    setShowForm(true);
    setForm({
      title: event.title,
      description: event.description,
      source: event.source,
      location: event.location,
      allDay: event.allDay,
      eventTime: event.eventTime,
      month: event.month,
      day: event.day,
      festival: event.festival,
      year: event.year,
      repeatRule: event.repeatRule,
    });
    setMessage(null);
  }

  function selectDay(day: number) {
    const date: HarptosDate = { year: viewYear, month: viewMonth, day };
    setSelectedDate(date);
    setShowForm(false);
    setEditingId(null);
    setMessage(null);
  }

  function selectFestival(festivalId: HarptosFestivalId) {
    setSelectedDate(festivalDate(viewYear, festivalId));
    setShowForm(false);
    setEditingId(null);
    setMessage(null);
  }

  function goToTodayView() {
    setViewYear(today.year);
    setViewMonth(today.month);
    setSelectedDate(today);
  }

  function shiftViewMonth(delta: number) {
    const next = addMonths({ year: viewYear, month: viewMonth }, delta);
    setViewYear(next.year);
    setViewMonth(next.month);
  }

  async function saveCurrentDate(nextDate: HarptosDate) {
    const supabase = createClient();
    const { error } = await supabase
      .from("campaigns")
      .update({
        world_data: {
          ...worldData,
          calendar: nextDate,
        },
      })
      .eq("id", campaignId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setViewYear(nextDate.year);
    setViewMonth(nextDate.month);
    setSelectedDate(nextDate);
  }

  async function handleSubmit() {
    if (!userId || !canManageEvents) return;

    const parsed = calendarEventFormSchema.safeParse(form);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Invalid event");
      return;
    }

    setSaving(true);
    setMessage(null);
    const supabase = createClient();

    const { error } = editingId
      ? await supabase
          .from("campaign_calendar_events")
          .update(calendarEventToUpdate(parsed.data))
          .eq("id", editingId)
      : await supabase
          .from("campaign_calendar_events")
          .insert(
            calendarEventToInsert(campaignId, parsed.data, userId)
          );

    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    resetForm();
  }

  async function handleDelete(eventId: string) {
    if (!canManageEvents) return;
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("campaign_calendar_events")
      .delete()
      .eq("id", eventId);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (editingId === eventId) resetForm();
  }

  function openAddEventForm() {
    setShowForm(true);
    setEditingId(null);
    setForm(emptyEventForm(selectedDate));
    setMessage(null);
  }

  const viewingTodayMonth =
    viewYear === today.year &&
    viewMonth === today.month &&
    (!today.festival ||
      monthFestivals.some((festival) => festival.id === today.festival));

  return (
    <section className="retro-box harptos-calendar">
      <div className="retro-section-header animals-section-header">
        <p className="retro-box-title">Calendar</p>
        {showDmUi ? (
          <div className="harptos-today-controls">
            <button
              type="button"
              className="retro-inline-link"
              onClick={() => saveCurrentDate(addDays(today, -1))}
            >
              −1 day
            </button>
            <button
              type="button"
              className="retro-inline-link"
              onClick={() => saveCurrentDate(addDays(today, 1))}
            >
              +1 day
            </button>
            {!sameHarptosDate(selectedDate, today) ? (
              <button
                type="button"
                className="retro-inline-link"
                onClick={() => saveCurrentDate(selectedDate)}
              >
                Set today
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="retro-member-line">{formatHarptosDate(today)}</p>

      <div className="harptos-month-nav">
        <button
          type="button"
          className="candy-btn harptos-nav-btn"
          onClick={() => shiftViewMonth(-1)}
          aria-label="Previous month"
        >
          ‹
        </button>
        <div className="harptos-month-label">
          <strong>{monthViewLabel(viewYear, viewMonth)}</strong>
          {!viewingTodayMonth ? (
            <button
              type="button"
              className="retro-inline-link harptos-jump-today"
              onClick={goToTodayView}
            >
              Jump to today
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="candy-btn harptos-nav-btn"
          onClick={() => shiftViewMonth(1)}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <table className="retro-table harptos-grid">
        <thead>
          <tr>
            <th className="harptos-grid-tenday-col" />
            {Array.from({ length: 10 }, (_, index) => (
              <th key={index} className="harptos-grid-day-head">
                Day {index + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TENDAY_LABELS.map((label, tendayIndex) => (
            <tr key={label}>
              <th scope="row" className="harptos-grid-tenday-col">
                {label}
              </th>
              {Array.from({ length: 10 }, (_, index) => {
                const day = tendayIndex * 10 + index + 1;
                const cellDate: HarptosDate = {
                  year: viewYear,
                  month: viewMonth,
                  day,
                };
                const dayEvents = eventsByDay.get(day) ?? [];
                const isToday = sameHarptosDate(cellDate, today);
                const isSelected = sameHarptosDate(cellDate, selectedDate);
                const { dayInTenday } = getTendayInfo(day);

                return (
                  <td key={day} className="harptos-grid-cell-wrap">
                    <button
                      type="button"
                      className={[
                        "harptos-day",
                        isToday ? "harptos-day-today" : "",
                        isSelected ? "harptos-day-selected" : "",
                        dayEvents.length > 0 ? "harptos-day-has-events" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => selectDay(day)}
                      aria-label={`${day} ${HARPTOS_MONTHS[viewMonth - 1]}, day ${dayInTenday} of ${label}`}
                      aria-pressed={isSelected}
                    >
                      <span className="harptos-day-number">{day}</span>
                      {dayEvents.length > 0 ? (
                        <span className="harptos-day-events" title={dayEvents.map((e) => e.title).join(", ")}>
                          {dayEvents.length === 1
                            ? "•"
                            : `${dayEvents.length}●`}
                        </span>
                      ) : null}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
          {monthFestivals.map((festival) => {
            const festivalEvents = festivalEventsById.get(festival.id) ?? [];
            const cellDate = festivalDate(viewYear, festival.id);
            const isToday = sameHarptosDate(cellDate, today);
            const isSelected = sameHarptosDate(cellDate, selectedDate);

            return (
              <tr key={festival.id} className="harptos-festival-row">
                <th scope="row" className="harptos-grid-tenday-col">
                  {festival.leapYearOnly ? "Leap day" : "Festival"}
                </th>
                <td
                  colSpan={10}
                  className="harptos-grid-cell-wrap harptos-festival-cell-wrap"
                >
                  <button
                    type="button"
                    className={[
                      "harptos-day harptos-day-festival",
                      isToday ? "harptos-day-today" : "",
                      isSelected ? "harptos-day-selected" : "",
                      festivalEvents.length > 0 ? "harptos-day-has-events" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => selectFestival(festival.id)}
                    aria-label={`${festival.name}, ${viewYear} DR`}
                    aria-pressed={isSelected}
                  >
                    <span className="harptos-day-number">{festival.name}</span>
                    {festivalEvents.length > 0 ? (
                      <span
                        className="harptos-day-events"
                        title={festivalEvents.map((e) => e.title).join(", ")}
                      >
                        {festivalEvents.length === 1
                          ? "•"
                          : `${festivalEvents.length}●`}
                      </span>
                    ) : null}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="harptos-selected-day">
        <div className="harptos-selected-header">
          <p className="retro-box-subtitle">
            {formatHarptosDate(selectedDate)}
          </p>
          {canManageEvents && !showForm ? (
            <button
              type="button"
              className="retro-inline-link"
              onClick={openAddEventForm}
            >
              + Add event
            </button>
          ) : null}
        </div>

        {selectedEvents.length === 0 ? (
          <p className="retro-muted">No events on this day.</p>
        ) : (
          <CalendarEventList
            events={selectedEvents}
            canManageEvents={canManageEvents}
            onEdit={startEdit}
            onDelete={handleDelete}
          />
        )}
      </div>

      {showForm && canManageEvents ? (
        <CalendarEventForm
          form={form}
          saving={saving}
          editing={!!editingId}
          onChange={setForm}
          onSubmit={handleSubmit}
          onCancel={resetForm}
        />
      ) : null}

      {message ? <p className="retro-muted">{message}</p> : null}
    </section>
  );
}

function CalendarEventList({
  events,
  canManageEvents,
  onEdit,
  onDelete,
}: {
  events: ParsedCalendarEvent[];
  canManageEvents: boolean;
  onEdit: (event: ParsedCalendarEvent) => void;
  onDelete: (eventId: string) => void;
}) {
  return (
    <div className="calendar-event-list">
      {events.map((event) => (
        <div key={event.id} className="calendar-event-entry">
          <div className="calendar-event-header">
            <strong>{event.title}</strong>
            {canManageEvents ? (
              <span className="calendar-event-actions">
                <button
                  type="button"
                  className="retro-inline-link"
                  onClick={() => onEdit(event)}
                >
                  edit
                </button>
                <button
                  type="button"
                  className="retro-inline-link"
                  onClick={() => onDelete(event.id)}
                >
                  delete
                </button>
              </span>
            ) : null}
          </div>
          <p className="retro-member-line">
            {formatEventWhen(event)}
            {event.location ? ` · ${event.location}` : ""}
            {event.repeatRule !== "none"
              ? ` · ${CALENDAR_REPEAT_LABELS[event.repeatRule]}`
              : ""}
            {event.source ? ` · ${event.source}` : ""}
          </p>
          {event.description ? (
            <p className="retro-muted">{event.description}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function CalendarEventForm({
  form,
  saving,
  editing,
  onChange,
  onSubmit,
  onCancel,
}: {
  form: CalendarEventFormValues;
  saving: boolean;
  editing: boolean;
  onChange: (values: CalendarEventFormValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="calendar-event-form">
      <p className="retro-box-subtitle">
        {editing ? "Edit event" : "New event"}
      </p>
      <div className="calendar-event-fields">
        <div>
          <label className="candy-label">Title</label>
          <input
            className="candy-input"
            value={form.title}
            onChange={(e) => onChange({ ...form, title: e.target.value })}
          />
        </div>
        <div>
          <label className="candy-label">Description</label>
          <input
            className="candy-input"
            value={form.description}
            onChange={(e) =>
              onChange({ ...form, description: e.target.value })
            }
          />
        </div>
        <div>
          <label className="candy-label">Source</label>
          <input
            className="candy-input"
            placeholder="Session, dream, rumor…"
            value={form.source}
            onChange={(e) => onChange({ ...form, source: e.target.value })}
          />
        </div>
        <div>
          <label className="candy-label">Location</label>
          <input
            className="candy-input"
            placeholder="Phandalin, Wave Echo Cave…"
            value={form.location}
            onChange={(e) => onChange({ ...form, location: e.target.value })}
          />
        </div>
        <div>
          <label className="candy-label">Time</label>
          <div className="calendar-schedule-row">
            <label className="calendar-all-day-label">
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={(e) =>
                  onChange({
                    ...form,
                    allDay: e.target.checked,
                    eventTime: e.target.checked
                      ? null
                      : (form.eventTime ?? "12:00"),
                  })
                }
              />
              All day
            </label>
            {!form.allDay ? (
              <input
                className="candy-input calendar-time-input"
                inputMode="numeric"
                placeholder="14:30"
                maxLength={5}
                value={form.eventTime ?? ""}
                onChange={(e) =>
                  onChange({
                    ...form,
                    eventTime: e.target.value || null,
                  })
                }
                onBlur={(e) => {
                  const normalized = normalizeEventTimeInput(e.target.value);
                  if (normalized) {
                    onChange({ ...form, eventTime: normalized });
                  }
                }}
              />
            ) : null}
          </div>
        </div>
        <div className="calendar-event-date-row">
          {form.festival ? (
            <div className="calendar-event-festival-label">
              <label className="candy-label">Date</label>
              <p className="retro-member-line">
                {getFestivalById(form.festival)?.name ?? form.festival},{" "}
                {form.year ?? "every year"}
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="candy-label">Month</label>
                <select
                  className="candy-input"
                  value={form.month}
                  onChange={(e) =>
                    onChange({ ...form, month: Number(e.target.value) })
                  }
                >
                  {HARPTOS_MONTHS.map((name, index) => (
                    <option key={name} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="candy-label">Day</label>
                <input
                  className="candy-input"
                  type="number"
                  min={1}
                  max={30}
                  value={form.day}
                  onChange={(e) =>
                    onChange({ ...form, day: Number(e.target.value) || 1 })
                  }
                />
              </div>
            </>
          )}
          <div>
            <label className="candy-label">Year</label>
            <input
              className="candy-input"
              type="number"
              min={0}
              value={form.year ?? ""}
              placeholder="Optional"
              onChange={(e) => {
                const raw = e.target.value.trim();
                onChange({
                  ...form,
                  year: raw === "" ? null : Number(raw),
                });
              }}
            />
          </div>
        </div>
        <div>
          <label className="candy-label">Repeat</label>
          <select
            className="candy-input"
            value={form.repeatRule}
            onChange={(e) =>
              onChange({
                ...form,
                repeatRule: e.target.value as CalendarEventFormValues["repeatRule"],
              })
            }
          >
            {CALENDAR_REPEAT_RULES.map((rule) => (
              <option key={rule} value={rule}>
                {CALENDAR_REPEAT_LABELS[rule]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="party-inventory-save">
        <button
          type="button"
          className="candy-btn"
          onClick={onSubmit}
          disabled={saving}
        >
          {saving ? "..." : editing ? "Save event" : "Add event"}
        </button>
        <button type="button" className="retro-inline-link" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
