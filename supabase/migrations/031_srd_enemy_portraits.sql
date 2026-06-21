-- SRD monster token art from dnd5eapi.co (same source as 030_seed_srd_enemies.sql).
-- Skips enemies that already have a custom uploaded portrait in Supabase storage.

UPDATE public.enemies
SET data = jsonb_set(
  data,
  '{portraitPath}',
  to_jsonb('https://www.dnd5eapi.co/api/images/monsters/' || slug || '.png')
)
WHERE source = 'SRD'
  AND coalesce(data->>'portraitPath', '') = '';
