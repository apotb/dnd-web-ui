-- Campaign factions: organizations, guilds, and power groups.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS factions_data JSONB NOT NULL DEFAULT '{"categories":[],"factions":[]}';

CREATE OR REPLACE FUNCTION public.update_campaign_factions(
  p_campaign_id UUID,
  p_factions_data JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_campaign_dm(p_campaign_id)
    OR public.user_owns_character_in_campaign(p_campaign_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized to edit factions';
  END IF;

  UPDATE public.campaigns
  SET factions_data = p_factions_data
  WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_campaign_factions(UUID, JSONB) TO authenticated;
