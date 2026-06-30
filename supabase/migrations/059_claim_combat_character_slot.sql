-- Allow players to claim DM-placed character slot tokens on the combat board.

CREATE OR REPLACE FUNCTION public.claim_combat_character_slot(
  p_campaign_id UUID,
  p_token_id TEXT,
  p_character_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_character RECORD;
  v_campaign RECORD;
  v_char_data JSONB;
  v_combat JSONB;
  v_tokens JSONB;
  v_new_tokens JSONB := '[]'::jsonb;
  v_token JSONB;
  v_placeholder JSONB;
  v_found BOOLEAN := FALSE;
  v_label TEXT;
  v_portrait TEXT;
  v_current_hp INT;
  v_max_hp INT;
  v_excluded JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to claim a character token.';
  END IF;

  IF NOT public.is_campaign_participant(p_campaign_id) THEN
    RAISE EXCEPTION 'You do not have access to this campaign.';
  END IF;

  SELECT *
  INTO v_character
  FROM public.characters
  WHERE id = p_character_id
    AND campaign_id = p_campaign_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Character not found in this campaign.';
  END IF;

  IF v_character.owner_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'You can only claim a slot with your own character.';
  END IF;

  SELECT *
  INTO v_campaign
  FROM public.campaigns
  WHERE id = p_campaign_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found.';
  END IF;

  v_combat := COALESCE(v_campaign.combat_state, '{}'::jsonb);
  v_tokens := COALESCE(v_combat->'tokens', '[]'::jsonb);

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_tokens) AS t
    WHERE t->>'kind' = 'party'
      AND t->>'characterId' = p_character_id::text
  ) THEN
    RAISE EXCEPTION 'This character is already on the combat board.';
  END IF;

  SELECT t
  INTO v_placeholder
  FROM jsonb_array_elements(v_tokens) AS t
  WHERE t->>'id' = p_token_id
    AND t->>'kind' = 'party'
    AND COALESCE(t->>'characterId', '') = ''
  LIMIT 1;

  IF v_placeholder IS NULL THEN
    RAISE EXCEPTION 'Character slot not found or already claimed.';
  END IF;

  v_char_data := COALESCE(v_character.data, '{}'::jsonb);
  v_label := split_part(trim(v_character.name), ' ', 1);
  IF v_label = '' THEN
    v_label := trim(v_character.name);
  END IF;
  v_portrait := NULLIF(v_char_data #>> '{basicInfo,portrait}', '');
  v_current_hp := (v_char_data #>> '{combat,currentHp}')::INT;
  v_max_hp := (v_char_data #>> '{combat,maxHp}')::INT;

  FOR v_token IN SELECT value FROM jsonb_array_elements(v_tokens)
  LOOP
    IF v_token->>'id' = p_token_id THEN
      v_new_tokens := v_new_tokens || jsonb_build_array(
        v_token || jsonb_build_object(
          'id', p_character_id::text,
          'characterId', p_character_id::text,
          'name', v_character.name,
          'label', v_label,
          'portraitPath', to_jsonb(v_portrait),
          'currentHp', to_jsonb(v_current_hp),
          'maxHp', to_jsonb(v_max_hp)
        )
      );
      v_found := TRUE;
    ELSE
      v_new_tokens := v_new_tokens || jsonb_build_array(v_token);
    END IF;
  END LOOP;

  IF NOT v_found THEN
    RAISE EXCEPTION 'Character slot not found or already claimed.';
  END IF;

  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
  INTO v_excluded
  FROM jsonb_array_elements_text(COALESCE(v_combat->'excludedPartyCharacterIds', '[]'::jsonb)) AS elem
  WHERE elem <> p_character_id::text;

  v_combat := jsonb_set(v_combat, '{tokens}', v_new_tokens, true);
  v_combat := jsonb_set(v_combat, '{excludedPartyCharacterIds}', COALESCE(v_excluded, '[]'::jsonb), true);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_combat_character_slot(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_combat_character_slot(UUID, TEXT, UUID) TO authenticated;
