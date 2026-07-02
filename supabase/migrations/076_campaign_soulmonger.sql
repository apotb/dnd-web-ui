-- Soulmonger: DM-tracked souls with daily survival rolls.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS soulmonger_data JSONB NOT NULL
  DEFAULT '{"active":[],"devoured":[]}'::jsonb;
