-- Align existing default campaign dates with 1490 DR start year.

UPDATE public.campaigns
SET world_data = jsonb_set(world_data, '{calendar,year}', '1490'::jsonb, true)
WHERE world_data->'calendar'->>'year' = '1492'
  AND world_data->'calendar'->>'month' = '6'
  AND world_data->'calendar'->>'day' = '17';
