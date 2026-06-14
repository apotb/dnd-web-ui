-- Per-user, per-campaign notebook notes (private to each player/DM).

CREATE TABLE public.campaign_notebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, campaign_id)
);

CREATE INDEX campaign_notebooks_campaign_id_idx
  ON public.campaign_notebooks (campaign_id);

CREATE TRIGGER campaign_notebooks_updated_at
  BEFORE UPDATE ON public.campaign_notebooks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.campaign_notebooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own notebook"
  ON public.campaign_notebooks FOR SELECT
  USING (
    auth.uid() = user_id
    AND public.is_campaign_member(campaign_id)
  );

CREATE POLICY "Members can insert own notebook"
  ON public.campaign_notebooks FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_campaign_member(campaign_id)
  );

CREATE POLICY "Members can update own notebook"
  ON public.campaign_notebooks FOR UPDATE
  USING (
    auth.uid() = user_id
    AND public.is_campaign_member(campaign_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_campaign_member(campaign_id)
  );

CREATE POLICY "Members can delete own notebook"
  ON public.campaign_notebooks FOR DELETE
  USING (
    auth.uid() = user_id
    AND public.is_campaign_member(campaign_id)
  );
