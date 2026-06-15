-- Configure the Chult map as a hex-reveal map (fog-of-war hexes).

UPDATE public.campaigns
SET maps_data = jsonb_set(
  COALESCE(maps_data, '{}'::jsonb),
  '{revealedHexes}',
  COALESCE(maps_data->'revealedHexes', '{}'::jsonb),
  true
)
WHERE maps_data IS NOT NULL;

UPDATE public.campaigns
SET maps_data = jsonb_set(
  maps_data,
  '{maps}',
  (
    SELECT COALESCE(
      jsonb_agg(
        CASE
          WHEN elem->>'name' = 'Chult'
            THEN elem
              || '{"mapType":"hex-reveal","hexLayoutId":"chult"}'::jsonb
          ELSE elem
        END
      ),
      '[]'::jsonb
    )
    FROM jsonb_array_elements(COALESCE(maps_data->'maps', '[]'::jsonb)) AS elem
  ),
  true
)
WHERE jsonb_array_length(COALESCE(maps_data->'maps', '[]'::jsonb)) > 0;
