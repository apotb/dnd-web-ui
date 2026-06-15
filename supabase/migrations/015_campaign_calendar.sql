-- Faerûn calendar date on campaigns + shared calendar events.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS world_data JSONB NOT NULL DEFAULT '{"calendar":{"year":1490,"month":6,"day":17}}'::jsonb;

CREATE TABLE public.campaign_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 30),
  year INTEGER,
  repeat_rule TEXT NOT NULL DEFAULT 'none'
    CHECK (repeat_rule IN ('none', 'daily', 'tenday', 'monthly', 'yearly')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attribution TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX campaign_calendar_events_campaign_id_idx
  ON public.campaign_calendar_events (campaign_id);

CREATE TRIGGER campaign_calendar_events_updated_at
  BEFORE UPDATE ON public.campaign_calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.campaign_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view calendar events"
  ON public.campaign_calendar_events FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Participants can insert calendar events"
  ON public.campaign_calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.is_campaign_dm(campaign_id)
      OR public.user_owns_character_in_campaign(campaign_id)
    )
  );

CREATE POLICY "Owner or DM can update calendar events"
  ON public.campaign_calendar_events FOR UPDATE
  TO authenticated
  USING (
    public.is_campaign_dm(campaign_id)
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.is_campaign_dm(campaign_id)
    OR created_by = auth.uid()
  );

CREATE POLICY "Owner or DM can delete calendar events"
  ON public.campaign_calendar_events FOR DELETE
  TO authenticated
  USING (
    public.is_campaign_dm(campaign_id)
    OR created_by = auth.uid()
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_calendar_events;
