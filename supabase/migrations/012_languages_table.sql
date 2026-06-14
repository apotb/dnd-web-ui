-- Languages catalog for character creation and species grants.

CREATE TABLE public.languages (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  script      TEXT,
  is_standard BOOLEAN NOT NULL DEFAULT false,
  source      TEXT    NOT NULL DEFAULT 'SRD',
  description TEXT    NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read languages" ON public.languages
  FOR SELECT USING (true);

CREATE POLICY "DMs manage languages" ON public.languages FOR ALL
  USING (EXISTS (SELECT 1 FROM public.campaign_members WHERE user_id = auth.uid() AND role = 'dm'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaign_members WHERE user_id = auth.uid() AND role = 'dm'));

INSERT INTO public.languages (slug, name, script, is_standard, source, description) VALUES
  ('common', 'Common', 'Common', true, 'PHB', ''),
  ('dwarvish', 'Dwarvish', 'Dwarvish', true, 'PHB', ''),
  ('elvish', 'Elvish', 'Elvish', true, 'PHB', ''),
  ('giant', 'Giant', 'Dwarvish', true, 'PHB', ''),
  ('gnomish', 'Gnomish', 'Dwarvish', true, 'PHB', ''),
  ('goblin', 'Goblin', 'Dwarvish', true, 'PHB', ''),
  ('halfling', 'Halfling', 'Common', true, 'PHB', ''),
  ('orc', 'Orc', 'Dwarvish', true, 'PHB', ''),
  ('abyssal', 'Abyssal', 'Infernal', true, 'PHB', ''),
  ('celestial', 'Celestial', 'Celestial', true, 'PHB', ''),
  ('draconic', 'Draconic', 'Draconic', true, 'PHB', ''),
  ('deep-speech', 'Deep Speech', NULL, true, 'PHB', 'No written form.'),
  ('infernal', 'Infernal', 'Infernal', true, 'PHB', ''),
  ('primordial', 'Primordial', 'Dwarvish', true, 'PHB', ''),
  ('sylvan', 'Sylvan', 'Elvish', true, 'PHB', ''),
  ('undercommon', 'Undercommon', 'Elvish', true, 'PHB', ''),
  ('gith', 'Gith', NULL, false, 'Mordenkainen''s Tome of Foes', ''),
  ('quori', 'Quori', NULL, false, 'Eberron', ''),
  ('aarakocra', 'Aarakocra', NULL, false, 'Elemental Evil', ''),
  ('auran', 'Auran', 'Dwarvish', false, 'PHB', 'Primordial dialect (air).'),
  ('aquan', 'Aquan', 'Dwarvish', false, 'PHB', 'Primordial dialect (water).'),
  ('ignan', 'Ignan', 'Dwarvish', false, 'PHB', 'Primordial dialect (fire).'),
  ('terran', 'Terran', 'Dwarvish', false, 'PHB', 'Primordial dialect (earth).');
