-- DMs can claim multiple unclaimed characters in their campaign.
-- Players remain limited to one claim per campaign.

DROP INDEX IF EXISTS public.idx_characters_one_owner_per_campaign;

DROP POLICY IF EXISTS "Authenticated users can claim unclaimed characters" ON public.characters;

CREATE POLICY "Authenticated users can claim unclaimed characters"
  ON public.characters FOR UPDATE
  TO authenticated
  USING (
    owner_user_id IS NULL
    AND (
      public.is_campaign_dm(campaign_id)
      OR NOT public.user_owns_character_in_campaign(campaign_id)
    )
  )
  WITH CHECK (
    owner_user_id = auth.uid()
    AND (
      public.is_campaign_dm(campaign_id)
      OR NOT EXISTS (
        SELECT 1
        FROM public.characters c
        WHERE c.campaign_id = campaign_id
          AND c.owner_user_id = auth.uid()
          AND c.id <> id
      )
    )
  );
