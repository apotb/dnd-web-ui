-- Players can claim unclaimed characters and edit their own sheet.

ALTER TABLE public.characters
  ADD COLUMN owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX idx_characters_owner ON public.characters(owner_user_id);

CREATE OR REPLACE FUNCTION public.is_character_owner(p_character_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.characters
    WHERE id = p_character_id
      AND owner_user_id = auth.uid()
  );
$$;

CREATE POLICY "Authenticated users can claim unclaimed characters"
  ON public.characters FOR UPDATE
  TO authenticated
  USING (owner_user_id IS NULL)
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owner can update their character"
  ON public.characters FOR UPDATE
  TO authenticated
  USING (public.is_character_owner(id))
  WITH CHECK (public.is_character_owner(id));
