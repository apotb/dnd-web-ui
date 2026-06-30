-- Per-campaign saved combat encounter setups (pre-battle board layouts).

CREATE TABLE public.saved_encounters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  background_path TEXT,
  grid_width      INT NOT NULL DEFAULT 40 CHECK (grid_width >= 10 AND grid_width <= 60),
  grid_height     INT NOT NULL DEFAULT 40 CHECK (grid_height >= 10 AND grid_height <= 60),
  tile_feet       INT NOT NULL DEFAULT 5 CHECK (tile_feet >= 1 AND tile_feet <= 30),
  blocked_cells   JSONB NOT NULL DEFAULT '[]'::jsonb,
  data            JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_cr        NUMERIC NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_encounters_campaign ON public.saved_encounters(campaign_id);
CREATE INDEX idx_saved_encounters_campaign_name ON public.saved_encounters(campaign_id, name);
CREATE INDEX idx_saved_encounters_campaign_cr ON public.saved_encounters(campaign_id, total_cr);
CREATE INDEX idx_saved_encounters_campaign_updated ON public.saved_encounters(campaign_id, updated_at DESC);

CREATE TRIGGER saved_encounters_updated_at
  BEFORE UPDATE ON public.saved_encounters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.saved_encounters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view saved encounters"
  ON public.saved_encounters FOR SELECT
  TO authenticated
  USING (public.is_campaign_member(campaign_id));

CREATE POLICY "DMs can insert saved encounters"
  ON public.saved_encounters FOR INSERT
  TO authenticated
  WITH CHECK (public.is_campaign_dm(campaign_id));

CREATE POLICY "DMs can update saved encounters"
  ON public.saved_encounters FOR UPDATE
  TO authenticated
  USING (public.is_campaign_dm(campaign_id))
  WITH CHECK (public.is_campaign_dm(campaign_id));

CREATE POLICY "DMs can delete saved encounters"
  ON public.saved_encounters FOR DELETE
  TO authenticated
  USING (public.is_campaign_dm(campaign_id));
