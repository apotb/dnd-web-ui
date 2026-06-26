-- Little Bag of Sand (scholar's pack component; SRD adventuring gear).
INSERT INTO public.items (slug, name, category, subcategory, source, rarity, weight_lb, cost_gp, description, properties) VALUES
('little-bag-of-sand', 'Little Bag of Sand', 'adventuring_gear', null, 'SRD', 'common', 0, 0, 'A small bag of sand, typically found in a scholar''s pack.', '{}')
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  category    = EXCLUDED.category,
  weight_lb   = EXCLUDED.weight_lb,
  cost_gp     = EXCLUDED.cost_gp,
  description = EXCLUDED.description,
  properties  = EXCLUDED.properties,
  updated_at  = now();
