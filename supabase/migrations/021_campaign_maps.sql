-- Campaign maps: metadata + markers in JSONB, images in Supabase Storage.

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS maps_data JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Seed starter maps for existing campaigns (Port Nyanzaru, Chult, Faerûn).
UPDATE public.campaigns
SET maps_data = jsonb_build_object(
  'maps', jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'name', 'Port Nyanzaru',
      'imagePath', null,
      'sortOrder', 0
    ),
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'name', 'Chult',
      'imagePath', null,
      'sortOrder', 1
    ),
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'name', 'Faerûn',
      'imagePath', null,
      'sortOrder', 2
    )
  ),
  'markers', jsonb_build_array()
)
WHERE maps_data = '{}'::jsonb OR maps_data IS NULL;

-- Add default party marker on the first map (Port Nyanzaru).
UPDATE public.campaigns
SET maps_data = jsonb_set(
  maps_data,
  '{markers}',
  jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'mapId', maps_data->'maps'->0->>'id',
      'label', 'Party',
      'color', '#22c55e',
      'x', 0.5,
      'y', 0.5
    )
  ),
  true
)
WHERE jsonb_array_length(COALESCE(maps_data->'maps', '[]'::jsonb)) > 0
  AND jsonb_array_length(COALESCE(maps_data->'markers', '[]'::jsonb)) = 0;

-- ---------------------------------------------------------------------------
-- Storage bucket for campaign map images
-- Path: {campaign_id}/{map_id}/{filename}
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-maps',
  'campaign-maps',
  true,
  15728640,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view campaign map images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'campaign-maps');

CREATE POLICY "DM can upload campaign map images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'campaign-maps'
    AND public.is_campaign_dm(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "DM can update campaign map images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'campaign-maps'
    AND public.is_campaign_dm(((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'campaign-maps'
    AND public.is_campaign_dm(((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "DM can delete campaign map images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'campaign-maps'
    AND public.is_campaign_dm(((storage.foldername(name))[1])::uuid)
  );
