-- Notable portrait images in Supabase Storage.
-- Path: {campaign_id}/{notable_id}/{filename}

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'notable-portraits',
  'notable-portraits',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view notable portraits"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'notable-portraits');

CREATE POLICY "DM can upload notable portraits"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'notable-portraits'
    AND public.is_campaign_dm(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "DM can update notable portraits"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'notable-portraits'
    AND public.is_campaign_dm(((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'notable-portraits'
    AND public.is_campaign_dm(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "DM can delete notable portraits"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'notable-portraits'
    AND public.is_campaign_dm(((storage.foldername(name))[1])::uuid)
  );
