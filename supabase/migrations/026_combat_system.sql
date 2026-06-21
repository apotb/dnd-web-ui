-- Combat system: global enemy/encounter catalogs, campaign combat_state, drop legacy encounters.

-- ──────────────────────────────────────────────────────────────────────────────
-- Drop legacy encounter tables
-- ──────────────────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime DROP TABLE public.encounter_combatants;
ALTER PUBLICATION supabase_realtime DROP TABLE public.encounters;

DROP POLICY IF EXISTS "Members can view combatants" ON public.encounter_combatants;
DROP POLICY IF EXISTS "DM can insert combatants" ON public.encounter_combatants;
DROP POLICY IF EXISTS "DM can update combatants" ON public.encounter_combatants;
DROP POLICY IF EXISTS "DM can delete combatants" ON public.encounter_combatants;
DROP POLICY IF EXISTS "Members can view encounters" ON public.encounters;
DROP POLICY IF EXISTS "DM can insert encounters" ON public.encounters;
DROP POLICY IF EXISTS "DM can update encounters" ON public.encounters;
DROP POLICY IF EXISTS "DM can delete encounters" ON public.encounters;

DROP TABLE IF EXISTS public.encounter_combatants;
DROP TABLE IF EXISTS public.encounters;
DROP FUNCTION IF EXISTS public.encounter_campaign_id(UUID);

-- ──────────────────────────────────────────────────────────────────────────────
-- Campaign combat board state (JSONB)
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS combat_state JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ──────────────────────────────────────────────────────────────────────────────
-- Global enemy catalog
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.enemies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  source     TEXT NOT NULL DEFAULT 'Custom',
  data       JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER enemies_updated_at
  BEFORE UPDATE ON public.enemies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- Global encounter templates
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.encounter_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  background_path TEXT,
  grid_width      INT NOT NULL DEFAULT 40 CHECK (grid_width >= 10 AND grid_width <= 60),
  grid_height     INT NOT NULL DEFAULT 40 CHECK (grid_height >= 10 AND grid_height <= 60),
  data            JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER encounter_templates_updated_at
  BEFORE UPDATE ON public.encounter_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- Seed Thug example enemy
-- ──────────────────────────────────────────────────────────────────────────────
INSERT INTO public.enemies (slug, name, source, data)
VALUES (
  'thug',
  'Thug',
  'Basic Rules (2014)',
  jsonb_build_object(
    'sizeType', 'Medium Humanoid (Any Race), Any Non-Good Alignment',
    'armorClass', jsonb_build_object('value', 11, 'note', 'leather armor'),
    'hitPoints', jsonb_build_object('average', 32, 'formula', '5d8 + 10'),
    'speed', '30 ft.',
    'abilityScores', jsonb_build_object('str', 15, 'dex', 11, 'con', 14, 'int', 10, 'wis', 10, 'cha', 11),
    'skills', jsonb_build_array(jsonb_build_object('name', 'Intimidation', 'bonus', 2)),
    'senses', 'Passive Perception 10',
    'languages', 'Any one language (usually Common)',
    'challengeRating', '1/2',
    'xp', 100,
    'proficiencyBonus', 2,
    'traits', jsonb_build_array(
      jsonb_build_object(
        'name', 'Pack Tactics',
        'description', 'The thug has advantage on an attack roll against a creature if at least one of the thug''s allies is within 5 feet of the creature and the ally isn''t incapacitated.'
      )
    ),
    'actions', jsonb_build_array(
      jsonb_build_object('name', 'Multiattack', 'description', 'The thug makes two melee attacks.'),
      jsonb_build_object('name', 'Mace', 'description', 'Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 5 (1d6 + 2) bludgeoning damage.'),
      jsonb_build_object('name', 'Heavy Crossbow', 'description', 'Ranged Weapon Attack: +2 to hit, range 100/400 ft., one target. Hit: 5 (1d10) piercing damage.')
    ),
    'description', 'Thugs are ruthless enforcers skilled at intimidation and violence. They work for money and have few scruples.',
    'tags', jsonb_build_array('NPC'),
    'habitat', 'URBAN'
  )
)
ON CONFLICT (slug) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────────
-- Row level security
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.enemies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read enemies" ON public.enemies FOR SELECT USING (true);
CREATE POLICY "Public read encounter templates" ON public.encounter_templates FOR SELECT USING (true);

CREATE POLICY "DMs manage enemies" ON public.enemies FOR ALL
  USING (EXISTS (SELECT 1 FROM public.campaign_members WHERE user_id = auth.uid() AND role = 'dm'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaign_members WHERE user_id = auth.uid() AND role = 'dm'));

CREATE POLICY "DMs manage encounter templates" ON public.encounter_templates FOR ALL
  USING (EXISTS (SELECT 1 FROM public.campaign_members WHERE user_id = auth.uid() AND role = 'dm'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaign_members WHERE user_id = auth.uid() AND role = 'dm'));

-- ──────────────────────────────────────────────────────────────────────────────
-- Storage: combat-content (enemy portraits + encounter backgrounds)
-- Path: enemies/{slug}/{filename} or encounters/{slug}/{filename}
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_any_campaign_dm()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaign_members
    WHERE user_id = auth.uid()
      AND role = 'dm'
  );
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'combat-content',
  'combat-content',
  true,
  15728640,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view combat content images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'combat-content');

CREATE POLICY "DMs can upload combat content images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'combat-content'
    AND public.is_any_campaign_dm()
  );

CREATE POLICY "DMs can update combat content images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'combat-content' AND public.is_any_campaign_dm())
  WITH CHECK (bucket_id = 'combat-content' AND public.is_any_campaign_dm());

CREATE POLICY "DMs can delete combat content images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'combat-content' AND public.is_any_campaign_dm());
