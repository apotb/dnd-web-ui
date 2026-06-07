-- Each account can claim at most one character per campaign.

CREATE OR REPLACE FUNCTION public.user_owns_character_in_campaign(p_campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.characters
    WHERE campaign_id = p_campaign_id
      AND owner_user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Authenticated users can claim unclaimed characters" ON public.characters;

CREATE POLICY "Authenticated users can claim unclaimed characters"
  ON public.characters FOR UPDATE
  TO authenticated
  USING (
    owner_user_id IS NULL
    AND NOT public.user_owns_character_in_campaign(campaign_id)
  )
  WITH CHECK (
    owner_user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1
      FROM public.characters c
      WHERE c.campaign_id = campaign_id
        AND c.owner_user_id = auth.uid()
        AND c.id <> id
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_characters_one_owner_per_campaign
  ON public.characters (campaign_id, owner_user_id)
  WHERE owner_user_id IS NOT NULL;
