-- Location, time, and all-day flag for calendar events.

ALTER TABLE public.campaign_calendar_events
  ADD COLUMN IF NOT EXISTS location TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS event_time TIME,
  ADD COLUMN IF NOT EXISTS all_day BOOLEAN NOT NULL DEFAULT false;
