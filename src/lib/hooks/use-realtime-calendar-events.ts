"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  parseCalendarEventRow,
  type ParsedCalendarEvent,
} from "@/lib/schemas/calendar-event";
import type { CampaignCalendarEvent } from "@/lib/types/database";

export function useRealtimeCalendarEvents(
  campaignId: string,
  initialEvents: ParsedCalendarEvent[]
) {
  const [events, setEvents] = useState(initialEvents);

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`calendar-events:${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "campaign_calendar_events",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id?: string };
            if (old.id) {
              setEvents((prev) => prev.filter((event) => event.id !== old.id));
            }
            return;
          }

          const row = payload.new as Partial<CampaignCalendarEvent> & {
            id?: string;
          };
          if (!row.id) return;
          const eventId = row.id;

          setEvents((prev) => {
            const idx = prev.findIndex((event) => event.id === eventId);
            const existing = idx >= 0 ? prev[idx] : null;
            const merged: CampaignCalendarEvent = {
              id: eventId,
              campaign_id: row.campaign_id ?? existing?.campaignId ?? campaignId,
              title: row.title ?? existing?.title ?? "",
              description: row.description ?? existing?.description ?? "",
              source: row.source ?? existing?.source ?? "",
              location: row.location ?? existing?.location ?? "",
              event_time:
                row.event_time !== undefined
                  ? row.event_time
                  : (existing?.eventTime ?? null),
              all_day: row.all_day ?? existing?.allDay ?? false,
              month: row.month ?? existing?.month ?? 1,
              day: row.day ?? existing?.day ?? 1,
              festival:
                row.festival !== undefined
                  ? row.festival
                  : (existing?.festival ?? null),
              year: row.year !== undefined ? row.year : (existing?.year ?? null),
              repeat_rule:
                row.repeat_rule ?? existing?.repeatRule ?? "none",
              created_by: row.created_by ?? "",
              attribution: row.attribution ?? "",
              created_at: row.created_at ?? existing?.createdAt ?? "",
              updated_at: row.updated_at ?? existing?.updatedAt ?? "",
            };
            const parsed = parseCalendarEventRow(merged);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = parsed;
              return next;
            }
            return [...prev, parsed].sort((a, b) =>
              a.month === b.month ? a.day - b.day : a.month - b.month
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  return events;
}
