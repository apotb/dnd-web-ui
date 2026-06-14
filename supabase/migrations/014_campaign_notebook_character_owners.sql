-- Allow DMs and players who claimed a character to use campaign notebooks.
-- campaign_members only stores the DM; players participate via character ownership.

DROP POLICY IF EXISTS "Members can view own notebook" ON public.campaign_notebooks;
DROP POLICY IF EXISTS "Members can insert own notebook" ON public.campaign_notebooks;
DROP POLICY IF EXISTS "Members can update own notebook" ON public.campaign_notebooks;
DROP POLICY IF EXISTS "Members can delete own notebook" ON public.campaign_notebooks;

CREATE POLICY "Members can view own notebook"
  ON public.campaign_notebooks FOR SELECT
  USING (
    auth.uid() = user_id
    AND (
      public.is_campaign_member(campaign_id)
      OR public.user_owns_character_in_campaign(campaign_id)
    )
  );

CREATE POLICY "Members can insert own notebook"
  ON public.campaign_notebooks FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.is_campaign_member(campaign_id)
      OR public.user_owns_character_in_campaign(campaign_id)
    )
  );

CREATE POLICY "Members can update own notebook"
  ON public.campaign_notebooks FOR UPDATE
  USING (
    auth.uid() = user_id
    AND (
      public.is_campaign_member(campaign_id)
      OR public.user_owns_character_in_campaign(campaign_id)
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.is_campaign_member(campaign_id)
      OR public.user_owns_character_in_campaign(campaign_id)
    )
  );

CREATE POLICY "Members can delete own notebook"
  ON public.campaign_notebooks FOR DELETE
  USING (
    auth.uid() = user_id
    AND (
      public.is_campaign_member(campaign_id)
      OR public.user_owns_character_in_campaign(campaign_id)
    )
  );
