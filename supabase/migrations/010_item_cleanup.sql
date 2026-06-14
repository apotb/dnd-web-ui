-- Item catalog cleanup: remove generic placeholders, fix miscategorized gear, add signal horn.

-- Generic placeholders — specific tools exist via subcategory (artisans_tools, musical_instrument).
DELETE FROM public.items WHERE slug IN ('artisans-tools', 'musical-instrument');

-- City Watch / military horn (not a musical instrument).
INSERT INTO public.items (slug, name, category, subcategory, source, rarity, weight_lb, cost_gp, description, properties) VALUES
('signal-horn', 'Signal horn', 'adventuring_gear', null, 'PHB', 'common', 2, 3, 'A horn used to sound alerts and signals.', '{}')
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  category    = EXCLUDED.category,
  description = EXCLUDED.description,
  updated_at  = now();

-- PHB background items that function as weapons.
UPDATE public.items SET
  category    = 'weapon',
  subcategory = 'simple_melee',
  properties  = '{"damage":"1d4","damageType":"bludgeoning","weaponCategory":"simple","weaponRange":"melee","weaponProperties":["light"]}'::jsonb,
  updated_at  = now()
WHERE slug = 'belaying-pin';

UPDATE public.items SET
  category    = 'weapon',
  subcategory = 'simple_melee',
  properties  = '{"damage":"1d4","damageType":"piercing","weaponCategory":"simple","weaponRange":"melee","weaponProperties":["finesse","light"]}'::jsonb,
  updated_at  = now()
WHERE slug = 'small-knife';

UPDATE public.items SET
  category    = 'weapon',
  subcategory = 'simple_melee',
  properties  = '{"damage":"1d6","damageType":"bludgeoning","weaponCategory":"simple","weaponRange":"melee","weaponProperties":["versatile"],"versatileDamage":"1d8"}'::jsonb,
  updated_at  = now()
WHERE slug = 'walking-staff';
