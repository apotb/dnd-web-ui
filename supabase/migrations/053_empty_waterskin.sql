-- Empty waterskin (left after drinking from a full waterskin).
INSERT INTO public.items (slug, name, category, subcategory, source, rarity, weight_lb, cost_gp, description, properties) VALUES
('empty-waterskin', 'Empty waterskin', 'adventuring_gear', null, 'SRD', 'common', 1, 0.2, 'A waterskin with no water left.', '{}')
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  category    = EXCLUDED.category,
  weight_lb   = EXCLUDED.weight_lb,
  cost_gp     = EXCLUDED.cost_gp,
  description = EXCLUDED.description,
  properties  = EXCLUDED.properties,
  updated_at  = now();
