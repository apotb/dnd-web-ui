-- Block of Incense (priest's pack component; SRD adventuring gear).
INSERT INTO public.items (slug, name, category, subcategory, source, rarity, weight_lb, cost_gp, description, properties) VALUES
('block-of-incense', 'Block of Incense', 'adventuring_gear', null, 'SRD', 'common', 0, 0, 'A block of incense, typically found in a priest''s pack.', '{}')
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  category    = EXCLUDED.category,
  weight_lb   = EXCLUDED.weight_lb,
  cost_gp     = EXCLUDED.cost_gp,
  description = EXCLUDED.description,
  properties  = EXCLUDED.properties,
  updated_at  = now();
