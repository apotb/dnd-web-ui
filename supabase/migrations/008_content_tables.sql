-- Content tables: spells, species, classes, backgrounds, feats
-- Each entity stores its full structured data as JSONB so DMs can add custom entries.
-- Spells also have dedicated columns for the most-queried fields.

-- ──────────────────────────────────────────────────────────────────────────────
-- SPELLS
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.spells (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  level         INT     NOT NULL DEFAULT 0,
  school        TEXT    NOT NULL DEFAULT '',
  casting_time  TEXT    NOT NULL DEFAULT '',
  range         TEXT    NOT NULL DEFAULT '',
  components    TEXT    NOT NULL DEFAULT '',
  duration      TEXT    NOT NULL DEFAULT '',
  description   TEXT    NOT NULL DEFAULT '',
  ritual        BOOLEAN NOT NULL DEFAULT false,
  concentration BOOLEAN NOT NULL DEFAULT false,
  classes       TEXT[]  NOT NULL DEFAULT '{}',
  source        TEXT    NOT NULL DEFAULT 'SRD',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- SPECIES
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.species (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL,
  source     TEXT    NOT NULL DEFAULT 'SRD',
  data       JSONB   NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- CLASSES
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.classes (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL,
  hit_die    INT     NOT NULL DEFAULT 8,
  source     TEXT    NOT NULL DEFAULT 'SRD',
  data       JSONB   NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- BACKGROUNDS
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.backgrounds (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL,
  source     TEXT    NOT NULL DEFAULT 'SRD',
  data       JSONB   NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- FEATS
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.feats (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         TEXT    NOT NULL UNIQUE,
  name         TEXT    NOT NULL,
  description  TEXT    NOT NULL DEFAULT '',
  prerequisite TEXT,
  source       TEXT    NOT NULL DEFAULT 'SRD',
  data         JSONB   NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.spells     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.species    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backgrounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feats      ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Public read spells"      ON public.spells      FOR SELECT USING (true);
CREATE POLICY "Public read species"     ON public.species     FOR SELECT USING (true);
CREATE POLICY "Public read classes"     ON public.classes     FOR SELECT USING (true);
CREATE POLICY "Public read backgrounds" ON public.backgrounds FOR SELECT USING (true);
CREATE POLICY "Public read feats"       ON public.feats       FOR SELECT USING (true);

-- Only DMs can write (same pattern as items table)
CREATE POLICY "DMs manage spells" ON public.spells FOR ALL
  USING (EXISTS (SELECT 1 FROM public.campaign_members WHERE user_id = auth.uid() AND role = 'dm'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaign_members WHERE user_id = auth.uid() AND role = 'dm'));

CREATE POLICY "DMs manage species" ON public.species FOR ALL
  USING (EXISTS (SELECT 1 FROM public.campaign_members WHERE user_id = auth.uid() AND role = 'dm'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaign_members WHERE user_id = auth.uid() AND role = 'dm'));

CREATE POLICY "DMs manage classes" ON public.classes FOR ALL
  USING (EXISTS (SELECT 1 FROM public.campaign_members WHERE user_id = auth.uid() AND role = 'dm'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaign_members WHERE user_id = auth.uid() AND role = 'dm'));

CREATE POLICY "DMs manage backgrounds" ON public.backgrounds FOR ALL
  USING (EXISTS (SELECT 1 FROM public.campaign_members WHERE user_id = auth.uid() AND role = 'dm'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaign_members WHERE user_id = auth.uid() AND role = 'dm'));

CREATE POLICY "DMs manage feats" ON public.feats FOR ALL
  USING (EXISTS (SELECT 1 FROM public.campaign_members WHERE user_id = auth.uid() AND role = 'dm'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaign_members WHERE user_id = auth.uid() AND role = 'dm'));
