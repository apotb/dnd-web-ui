-- Lay on Hands: consume action and optionally sync target token HP on the combat board.

CREATE OR REPLACE FUNCTION public.record_combat_lay_on_hands(
  p_campaign_id UUID,
  p_target_token_id TEXT DEFAULT NULL,
  p_target_current_hp INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_dm BOOLEAN;
  v_ctx RECORD;
  v_combat JSONB;
  v_turn JSONB;
  v_token JSONB;
  v_tokens JSONB;
  v_next_tokens JSONB := '[]'::jsonb;
  v_entry JSONB;
  v_character_id UUID;
  v_character JSONB;
  v_classes JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to use combat actions.';
  END IF;

  v_is_dm := public.is_campaign_dm(p_campaign_id);

  SELECT * INTO v_ctx
  FROM public.combat_assert_active_controller(p_campaign_id, v_user_id, v_is_dm);

  v_combat := v_ctx.v_combat;
  v_turn := v_ctx.v_turn;
  v_tokens := COALESCE(v_combat->'tokens', '[]'::jsonb);

  SELECT value
  INTO v_token
  FROM jsonb_array_elements(v_tokens) AS t(value)
  WHERE t.value->>'id' = v_ctx.v_token_id;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Combatant not found.';
  END IF;

  IF COALESCE(v_token->>'kind', '') <> 'party' THEN
    RAISE EXCEPTION 'Lay on Hands is only available to party characters.';
  END IF;

  v_character_id := NULLIF(v_token->>'characterId', '')::UUID;
  IF v_character_id IS NULL THEN
    RAISE EXCEPTION 'Combatant has no linked character.';
  END IF;

  SELECT c.data
  INTO v_character
  FROM public.characters c
  WHERE c.id = v_character_id
    AND c.campaign_id = p_campaign_id;

  IF v_character IS NULL THEN
    RAISE EXCEPTION 'Character not found.';
  END IF;

  v_classes := v_character->'basicInfo'->'classes';
  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(COALESCE(v_classes, '[]'::jsonb)) AS cls(value)
    WHERE lower(cls.value) = 'paladin'
  ) THEN
    RAISE EXCEPTION 'Lay on Hands requires the Paladin class.';
  END IF;

  IF public.combat_is_battle_over(v_combat) THEN
    v_turn := public.combat_reset_turn_economy(v_turn);
  ELSE
    IF COALESCE(v_turn->>'actionUsed', 'false')::BOOLEAN THEN
      RAISE EXCEPTION 'Your action has already been used this turn.';
    END IF;
    v_turn := jsonb_set(v_turn, '{actionUsed}', 'true'::jsonb, TRUE);
  END IF;

  FOR v_entry IN SELECT value FROM jsonb_array_elements(v_tokens) AS t(value)
  LOOP
    IF p_target_token_id IS NOT NULL
      AND p_target_current_hp IS NOT NULL
      AND v_entry->>'id' = p_target_token_id
    THEN
      v_entry := jsonb_set(v_entry, '{currentHp}', to_jsonb(p_target_current_hp), TRUE);
    END IF;
    v_next_tokens := v_next_tokens || jsonb_build_array(v_entry);
  END LOOP;

  v_combat := jsonb_set(v_combat, '{tokens}', v_next_tokens, TRUE);
  v_combat := jsonb_set(v_combat, '{turn}', v_turn, TRUE);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_combat_lay_on_hands(UUID, TEXT, INTEGER) TO authenticated;
