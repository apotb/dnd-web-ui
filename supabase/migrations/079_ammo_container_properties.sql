-- Structured ammo container capacity for quivers and bolt cases.
UPDATE public.items
SET properties = '{"capacity": 20, "acceptsItemSlug": "arrow"}'::jsonb,
    updated_at = now()
WHERE slug = 'quiver';

UPDATE public.items
SET properties = '{"capacity": 20, "acceptsItemSlug": "crossbow-bolt"}'::jsonb,
    updated_at = now()
WHERE slug = 'case-crossbow';
