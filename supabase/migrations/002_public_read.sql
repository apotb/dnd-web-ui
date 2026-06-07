-- Allow anyone with the campaign link to read live data (no login required).
-- Writes remain DM-only via existing policies.

CREATE POLICY "Public can view campaigns"
  ON public.campaigns FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can view characters"
  ON public.characters FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can view encounters"
  ON public.encounters FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Public can view visible combatants"
  ON public.encounter_combatants FOR SELECT
  TO anon
  USING (visible_to_players = true);
