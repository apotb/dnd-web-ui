-- Allow DMs and players with a claimed character to edit campaign notables.

CREATE OR REPLACE FUNCTION public.update_campaign_notables(
  p_campaign_id UUID,
  p_notables_data JSONB
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
    RAISE EXCEPTION 'Not authorized to edit notables';
  END IF;

  UPDATE public.campaigns
  SET notables_data = p_notables_data
  WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_campaign_notables(UUID, JSONB) TO authenticated;

CREATE POLICY "Participants can upload notable portraits"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'notable-portraits'
    AND public.user_owns_character_in_campaign(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Participants can update notable portraits"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'notable-portraits'
    AND public.user_owns_character_in_campaign(((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'notable-portraits'
    AND public.user_owns_character_in_campaign(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Participants can delete notable portraits"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'notable-portraits'
    AND public.user_owns_character_in_campaign(((storage.foldername(name))[1])::uuid)
  );
