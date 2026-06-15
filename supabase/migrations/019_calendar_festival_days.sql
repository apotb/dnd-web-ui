-- Festival days on the Calendar of Harptos (between months).

ALTER TABLE public.campaign_calendar_events
  ADD COLUMN IF NOT EXISTS festival TEXT
    CHECK (
      festival IS NULL
      OR festival IN (
        'midwinter',
        'greengrass',
        'midsummer',
        'highharvestide',
        'feast-of-the-moon'
      )
    );

ALTER TABLE public.campaign_calendar_events
  DROP CONSTRAINT IF EXISTS campaign_calendar_events_day_check;

ALTER TABLE public.campaign_calendar_events
  ADD CONSTRAINT campaign_calendar_events_day_check
  CHECK (
    (festival IS NOT NULL AND day = 0)
    OR (festival IS NULL AND day BETWEEN 1 AND 30)
  );
