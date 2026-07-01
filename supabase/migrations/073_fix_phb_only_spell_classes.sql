-- Restore class lists for PHB spells that were seeded with empty classes arrays.

UPDATE public.spells SET classes = '{"bard","sorcerer","warlock","wizard"}', updated_at = now() WHERE slug = 'blade-ward';
UPDATE public.spells SET classes = '{"bard","sorcerer","warlock","wizard"}', updated_at = now() WHERE slug = 'friends';
UPDATE public.spells SET classes = '{"druid"}', updated_at = now() WHERE slug = 'thorn-whip';
UPDATE public.spells SET classes = '{"warlock"}', updated_at = now() WHERE slug = 'armor-of-agathys';
UPDATE public.spells SET classes = '{"warlock"}', updated_at = now() WHERE slug = 'arms-of-hadar';
UPDATE public.spells SET classes = '{"sorcerer","wizard"}', updated_at = now() WHERE slug = 'chromatic-orb';
UPDATE public.spells SET classes = '{"cleric"}', updated_at = now() WHERE slug = 'guiding-hand';
UPDATE public.spells SET classes = '{"warlock"}', updated_at = now() WHERE slug = 'hex';
UPDATE public.spells SET classes = '{"sorcerer","wizard"}', updated_at = now() WHERE slug = 'ray-of-sickness';
UPDATE public.spells SET classes = '{"wizard"}', updated_at = now() WHERE slug = 'tensers-floating-disk';
UPDATE public.spells SET classes = '{"sorcerer","warlock","wizard"}', updated_at = now() WHERE slug = 'witch-bolt';
