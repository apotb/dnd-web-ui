-- Character portrait images in Supabase Storage.
-- Path: {campaign_id}/{character_id}/{filename}
-- Portrait path is stored in characters.data.basicInfo.portrait

CREATE OR REPLACE FUNCTION public.can_edit_character_portrait(
  p_campaign_id UUID,
  p_character_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_campaign_dm(p_campaign_id)
    OR EXISTS (
      SELECT 1
      FROM public.characters c
      WHERE c.id = p_character_id
        AND c.campaign_id = p_campaign_id
        AND c.owner_user_id = auth.uid()
    );
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'character-portraits',
  'character-portraits',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view character portraits"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'character-portraits');

CREATE POLICY "DM or owner can upload character portraits"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'character-portraits'
    AND public.can_edit_character_portrait(
      ((storage.foldername(name))[1])::uuid,
      ((storage.foldername(name))[2])::uuid
    )
  );

CREATE POLICY "DM or owner can update character portraits"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'character-portraits'
    AND public.can_edit_character_portrait(
      ((storage.foldername(name))[1])::uuid,
      ((storage.foldername(name))[2])::uuid
    )
  )
  WITH CHECK (
    bucket_id = 'character-portraits'
    AND public.can_edit_character_portrait(
      ((storage.foldername(name))[1])::uuid,
      ((storage.foldername(name))[2])::uuid
    )
  );

CREATE POLICY "DM or owner can delete character portraits"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'character-portraits'
    AND public.can_edit_character_portrait(
      ((storage.foldername(name))[1])::uuid,
      ((storage.foldername(name))[2])::uuid
    )
  );
