-- Add Ritual Casting to ritual-caster classes when missing from seeded catalog JSON.

UPDATE public.classes
SET
  data = jsonb_set(
    data,
    '{features}',
    COALESCE(data->'features', '[]'::jsonb)
      || jsonb_build_array(
        jsonb_build_object(
          'name', 'Ritual Casting',
          'slug', 'ritual-casting',
          'description',
          'Cast any bard spell you know with the ritual tag as a ritual (add 10 minutes; no spell slot).'
        )
      )
  ),
  updated_at = now()
WHERE slug = 'bard'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(data->'features', '[]'::jsonb)) AS feature
    WHERE feature->>'name' = 'Ritual Casting'
  );

UPDATE public.classes
SET
  data = jsonb_set(
    data,
    '{features}',
    COALESCE(data->'features', '[]'::jsonb)
      || jsonb_build_array(
        jsonb_build_object(
          'name', 'Ritual Casting',
          'slug', 'ritual-casting',
          'description',
          'Cast a prepared cleric spell with the ritual tag as a ritual (add 10 minutes; no spell slot).'
        )
      )
  ),
  updated_at = now()
WHERE slug = 'cleric'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(data->'features', '[]'::jsonb)) AS feature
    WHERE feature->>'name' = 'Ritual Casting'
  );

UPDATE public.classes
SET
  data = jsonb_set(
    data,
    '{features}',
    COALESCE(data->'features', '[]'::jsonb)
      || jsonb_build_array(
        jsonb_build_object(
          'name', 'Ritual Casting',
          'slug', 'ritual-casting',
          'description',
          'Cast a prepared druid spell with the ritual tag as a ritual (add 10 minutes; no spell slot).'
        )
      )
  ),
  updated_at = now()
WHERE slug = 'druid'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(data->'features', '[]'::jsonb)) AS feature
    WHERE feature->>'name' = 'Ritual Casting'
  );

UPDATE public.classes
SET
  data = jsonb_set(
    data,
    '{features}',
    COALESCE(data->'features', '[]'::jsonb)
      || jsonb_build_array(
        jsonb_build_object(
          'name', 'Ritual Casting',
          'slug', 'ritual-casting',
          'description',
          'Cast a wizard spell from your spellbook with the ritual tag as a ritual, even if not prepared (add 10 minutes; no spell slot).'
        )
      )
  ),
  updated_at = now()
WHERE slug = 'wizard'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(data->'features', '[]'::jsonb)) AS feature
    WHERE feature->>'name' = 'Ritual Casting'
  );
