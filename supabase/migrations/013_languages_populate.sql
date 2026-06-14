-- Idempotent language catalog seed (25 languages from character creator catalog).
-- Safe to re-run; also used by seed_default_languages() for admin UI.

INSERT INTO public.languages (slug, name, script, is_standard, source, description) VALUES
  ('aarakocra', 'Aarakocra', NULL, false, 'Elemental Evil', ''),
  ('abyssal', 'Abyssal', 'Infernal', true, 'PHB', ''),
  ('aquan', 'Aquan', 'Dwarvish', false, 'PHB', 'Primordial dialect (water).'),
  ('auran', 'Auran', 'Dwarvish', false, 'PHB', 'Primordial dialect (air).'),
  ('celestial', 'Celestial', 'Celestial', true, 'PHB', ''),
  ('common', 'Common', 'Common', true, 'PHB', ''),
  ('deep-speech', 'Deep Speech', NULL, true, 'PHB', 'No written form.'),
  ('draconic', 'Draconic', 'Draconic', true, 'PHB', ''),
  ('druidic', 'Druidic', NULL, false, 'PHB', 'Secret language of druids.'),
  ('dwarvish', 'Dwarvish', 'Dwarvish', true, 'PHB', ''),
  ('elvish', 'Elvish', 'Elvish', true, 'PHB', ''),
  ('giant', 'Giant', 'Dwarvish', true, 'PHB', ''),
  ('gith', 'Gith', NULL, false, 'Mordenkainen''s Tome of Foes', ''),
  ('gnomish', 'Gnomish', 'Dwarvish', true, 'PHB', ''),
  ('goblin', 'Goblin', 'Dwarvish', true, 'PHB', ''),
  ('halfling', 'Halfling', 'Common', true, 'PHB', ''),
  ('ignan', 'Ignan', 'Dwarvish', false, 'PHB', 'Primordial dialect (fire).'),
  ('infernal', 'Infernal', 'Infernal', true, 'PHB', ''),
  ('orc', 'Orc', 'Dwarvish', true, 'PHB', ''),
  ('primordial', 'Primordial', 'Dwarvish', true, 'PHB', ''),
  ('quori', 'Quori', NULL, false, 'Eberron', ''),
  ('sylvan', 'Sylvan', 'Elvish', true, 'PHB', ''),
  ('terran', 'Terran', 'Dwarvish', false, 'PHB', 'Primordial dialect (earth).'),
  ('thieves-cant', 'Thieves'' Cant', NULL, false, 'PHB', 'Secret mix of dialect, jargon, and code used by rogues.'),
  ('undercommon', 'Undercommon', 'Elvish', true, 'PHB', '')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  script = EXCLUDED.script,
  is_standard = EXCLUDED.is_standard,
  source = EXCLUDED.source,
  description = EXCLUDED.description,
  updated_at = NOW();

-- RPC for admin "Seed PHB languages" button (bypasses DM-only RLS on direct upsert).
CREATE OR REPLACE FUNCTION public.seed_default_languages()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.languages (slug, name, script, is_standard, source, description) VALUES
    ('aarakocra', 'Aarakocra', NULL, false, 'Elemental Evil', ''),
    ('abyssal', 'Abyssal', 'Infernal', true, 'PHB', ''),
    ('aquan', 'Aquan', 'Dwarvish', false, 'PHB', 'Primordial dialect (water).'),
    ('auran', 'Auran', 'Dwarvish', false, 'PHB', 'Primordial dialect (air).'),
    ('celestial', 'Celestial', 'Celestial', true, 'PHB', ''),
    ('common', 'Common', 'Common', true, 'PHB', ''),
    ('deep-speech', 'Deep Speech', NULL, true, 'PHB', 'No written form.'),
    ('draconic', 'Draconic', 'Draconic', true, 'PHB', ''),
    ('druidic', 'Druidic', NULL, false, 'PHB', 'Secret language of druids.'),
    ('dwarvish', 'Dwarvish', 'Dwarvish', true, 'PHB', ''),
    ('elvish', 'Elvish', 'Elvish', true, 'PHB', ''),
    ('giant', 'Giant', 'Dwarvish', true, 'PHB', ''),
    ('gith', 'Gith', NULL, false, 'Mordenkainen''s Tome of Foes', ''),
    ('gnomish', 'Gnomish', 'Dwarvish', true, 'PHB', ''),
    ('goblin', 'Goblin', 'Dwarvish', true, 'PHB', ''),
    ('halfling', 'Halfling', 'Common', true, 'PHB', ''),
    ('ignan', 'Ignan', 'Dwarvish', false, 'PHB', 'Primordial dialect (fire).'),
    ('infernal', 'Infernal', 'Infernal', true, 'PHB', ''),
    ('orc', 'Orc', 'Dwarvish', true, 'PHB', ''),
    ('primordial', 'Primordial', 'Dwarvish', true, 'PHB', ''),
    ('quori', 'Quori', NULL, false, 'Eberron', ''),
    ('sylvan', 'Sylvan', 'Elvish', true, 'PHB', ''),
    ('terran', 'Terran', 'Dwarvish', false, 'PHB', 'Primordial dialect (earth).'),
    ('thieves-cant', 'Thieves'' Cant', NULL, false, 'PHB', 'Secret mix of dialect, jargon, and code used by rogues.'),
    ('undercommon', 'Undercommon', 'Elvish', true, 'PHB', '')
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    script = EXCLUDED.script,
    is_standard = EXCLUDED.is_standard,
    source = EXCLUDED.source,
    description = EXCLUDED.description,
    updated_at = NOW();

  RETURN (SELECT count(*)::integer FROM public.languages);
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_default_languages() TO authenticated;
