-- Shieldmeet leap day (after Midsummer every four years).

ALTER TABLE public.campaign_calendar_events
  DROP CONSTRAINT IF EXISTS campaign_calendar_events_festival_check;

ALTER TABLE public.campaign_calendar_events
  ADD CONSTRAINT campaign_calendar_events_festival_check
  CHECK (
    festival IS NULL
    OR festival IN (
      'midwinter',
      'greengrass',
      'midsummer',
      'shieldmeet',
      'highharvestide',
      'feast-of-the-moon'
    )
  );
