-- Combat grid is fixed at 20×20; normalize any legacy 40×40 saved state.

UPDATE public.campaigns
SET combat_state = jsonb_set(
  jsonb_set(
    combat_state - 'loadedTemplateSlug' - 'encounterName' - 'backgroundPath',
    '{gridWidth}',
    '20'::jsonb
  ),
  '{gridHeight}',
  '20'::jsonb
)
WHERE combat_state IS NOT NULL
  AND combat_state <> '{}'::jsonb;
