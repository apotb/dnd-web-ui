-- Tej (Tomb of Annihilation — Chult honey wine).
INSERT INTO public.items (slug, name, category, subcategory, source, rarity, weight_lb, cost_gp, description, properties) VALUES
('tej', 'Tej (mug)', 'adventuring_gear', null, 'ToA', 'common', 1, 0.04, 'An amber-colored, fermented drink made from honey. More common and popular in Chult than beer or ale. A mug costs 4 cp in Port Nyanzaru or 6 cp in Fort Beluarian. A 1-gallon cask costs 2 sp in the city or 3 sp at the fort.', '{}')
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  category    = EXCLUDED.category,
  source      = EXCLUDED.source,
  weight_lb   = EXCLUDED.weight_lb,
  cost_gp     = EXCLUDED.cost_gp,
  description = EXCLUDED.description,
  properties  = EXCLUDED.properties,
  updated_at  = now();
