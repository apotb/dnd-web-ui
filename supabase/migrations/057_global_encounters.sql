-- Move encounter setups to the global catalog (like enemies), not per-campaign.

DROP TABLE IF EXISTS public.saved_encounters;

CREATE TABLE public.encounters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE INDEX idx_encounters_name ON public.encounters(name);
CREATE INDEX idx_encounters_total_cr ON public.encounters(total_cr);
CREATE INDEX idx_encounters_updated ON public.encounters(updated_at DESC);

CREATE TRIGGER encounters_updated_at
  BEFORE UPDATE ON public.encounters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read encounters"
  ON public.encounters FOR SELECT
  USING (true);

CREATE POLICY "DMs manage encounters"
  ON public.encounters FOR ALL
  USING (public.is_any_campaign_dm())
  WITH CHECK (public.is_any_campaign_dm());
