-- Remove SRD focus-flavor duplicates; keep canonical foci from migration 006.
-- Restore component-pouch category overwritten by 080_seed_srd_items.sql.

UPDATE public.items
SET category = 'focus',
    updated_at = now()
WHERE slug = 'component-pouch';

DELETE FROM public.items
WHERE slug IN (
  'sprig-of-mistletoe',
  'totem',
  'wooden-staff',
  'yew-wand',
  'crystal',
  'orb',
  'rod',
  'staff',
  'wand',
  'amulet',
  'emblem',
  'reliquary',
  'holy-water-flask'
);
