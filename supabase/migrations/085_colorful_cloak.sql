-- Colorful cloak (Tomb of Annihilation — Red Bazaar variant of lightweight hooded cloak).
INSERT INTO public.items (slug, name, category, subcategory, source, rarity, weight_lb, cost_gp, description, properties) VALUES
('colorful-cloak', 'Colorful cloak', 'adventuring_gear', null, 'ToA', 'common', 1, 1, 'A brightly dyed lightweight hooded cloak, sold in the Red Bazaar of Port Nyanzaru for 1 gp. Its vivid colors match the city''s painted buildings and the clothing favored by locals. While wearing this cloak in Port Nyanzaru, you have advantage on Dexterity (Stealth) checks to hide in a crowd and on Charisma (Deception) checks to pass as a local.', '{"variantOf":"lightweight-hooded-cloak"}')
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  category    = EXCLUDED.category,
  source      = EXCLUDED.source,
  weight_lb   = EXCLUDED.weight_lb,
  cost_gp     = EXCLUDED.cost_gp,
  description = EXCLUDED.description,
  properties  = EXCLUDED.properties,
  updated_at  = now();
