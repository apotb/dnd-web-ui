-- D&D Campaign Manager - Initial Schema
-- Run this in Supabase SQL Editor or via supabase db push
-- Run the entire script in one go (Select All → Run).

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Tables (must exist before RLS helper functions)
-- ---------------------------------------------------------------------------

CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.campaign_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('dm', 'player')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, user_id)
);

CREATE TABLE public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  player_name TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Encounter',
  round INTEGER NOT NULL DEFAULT 0,
  current_turn_index INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.encounter_combatants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  initiative INTEGER NOT NULL DEFAULT 10,
  sort_order INTEGER NOT NULL DEFAULT 0,
  visible_to_players BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX idx_campaign_members_user ON public.campaign_members(user_id);
CREATE INDEX idx_campaign_members_campaign ON public.campaign_members(campaign_id);
CREATE INDEX idx_characters_campaign ON public.characters(campaign_id);
CREATE INDEX idx_encounters_campaign ON public.encounters(campaign_id);
CREATE INDEX idx_encounter_combatants_encounter ON public.encounter_combatants(encounter_id);
CREATE INDEX idx_encounter_combatants_initiative ON public.encounter_combatants(encounter_id, initiative DESC, sort_order);

-- ---------------------------------------------------------------------------
-- Updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER characters_updated_at
  BEFORE UPDATE ON public.characters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER encounters_updated_at
  BEFORE UPDATE ON public.encounters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER encounter_combatants_updated_at
  BEFORE UPDATE ON public.encounter_combatants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Helper functions for RLS (after tables exist)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_campaign_member(p_campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaign_members
    WHERE campaign_id = p_campaign_id
      AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_campaign_dm(p_campaign_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaign_members
    WHERE campaign_id = p_campaign_id
      AND user_id = auth.uid()
      AND role = 'dm'
  );
$$;

CREATE OR REPLACE FUNCTION public.encounter_campaign_id(p_encounter_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT campaign_id FROM public.encounters WHERE id = p_encounter_id;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.encounter_combatants ENABLE ROW LEVEL SECURITY;

-- campaigns
CREATE POLICY "Members can view campaigns"
  ON public.campaigns FOR SELECT
  USING (public.is_campaign_member(id));

CREATE POLICY "Users can create campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "DM can update campaigns"
  ON public.campaigns FOR UPDATE
  USING (public.is_campaign_dm(id));

CREATE POLICY "DM can delete campaigns"
  ON public.campaigns FOR DELETE
  USING (public.is_campaign_dm(id));

-- campaign_members
CREATE POLICY "Members can view campaign members"
  ON public.campaign_members FOR SELECT
  USING (public.is_campaign_member(campaign_id));

CREATE POLICY "DM can manage campaign members"
  ON public.campaign_members FOR ALL
  USING (public.is_campaign_dm(campaign_id))
  WITH CHECK (public.is_campaign_dm(campaign_id));

-- characters
CREATE POLICY "Members can view characters"
  ON public.characters FOR SELECT
  USING (public.is_campaign_member(campaign_id));

CREATE POLICY "DM can insert characters"
  ON public.characters FOR INSERT
  WITH CHECK (public.is_campaign_dm(campaign_id));

CREATE POLICY "DM can update characters"
  ON public.characters FOR UPDATE
  USING (public.is_campaign_dm(campaign_id));

CREATE POLICY "DM can delete characters"
  ON public.characters FOR DELETE
  USING (public.is_campaign_dm(campaign_id));

-- encounters
CREATE POLICY "Members can view encounters"
  ON public.encounters FOR SELECT
  USING (public.is_campaign_member(campaign_id));

CREATE POLICY "DM can insert encounters"
  ON public.encounters FOR INSERT
  WITH CHECK (public.is_campaign_dm(campaign_id));

CREATE POLICY "DM can update encounters"
  ON public.encounters FOR UPDATE
  USING (public.is_campaign_dm(campaign_id));

CREATE POLICY "DM can delete encounters"
  ON public.encounters FOR DELETE
  USING (public.is_campaign_dm(campaign_id));

-- encounter_combatants
-- Players only see visible combatants; DMs see all
CREATE POLICY "Members can view combatants"
  ON public.encounter_combatants FOR SELECT
  USING (
    public.is_campaign_member(public.encounter_campaign_id(encounter_id))
    AND (
      public.is_campaign_dm(public.encounter_campaign_id(encounter_id))
      OR visible_to_players = true
    )
  );

CREATE POLICY "DM can insert combatants"
  ON public.encounter_combatants FOR INSERT
  WITH CHECK (public.is_campaign_dm(public.encounter_campaign_id(encounter_id)));

CREATE POLICY "DM can update combatants"
  ON public.encounter_combatants FOR UPDATE
  USING (public.is_campaign_dm(public.encounter_campaign_id(encounter_id)));

CREATE POLICY "DM can delete combatants"
  ON public.encounter_combatants FOR DELETE
  USING (public.is_campaign_dm(public.encounter_campaign_id(encounter_id)));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE public.characters;
ALTER PUBLICATION supabase_realtime ADD TABLE public.encounters;
ALTER PUBLICATION supabase_realtime ADD TABLE public.encounter_combatants;

-- ---------------------------------------------------------------------------
-- Auto-add creator as DM when campaign is created
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_campaign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.campaign_members (campaign_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'dm');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_campaign_created
  AFTER INSERT ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_campaign();
