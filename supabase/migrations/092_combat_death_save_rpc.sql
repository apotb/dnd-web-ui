-- Player RPC to mark the active combatant's death saving throw as rolled.
-- Without this, non-DM clients could never set turn.deathSaveRolled (players
-- cannot write combat_state directly), so the Saving Throws prompt persisted
-- and advance_combat_turn kept rejecting the end-turn request.

CREATE OR REPLACE FUNCTION public.record_combat_death_save(p_campaign_id UUID)
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
  v_token_id TEXT;
  v_token JSONB;
  v_character RECORD;
  v_character_hp INT;
  v_tokens JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to use combat actions.';
  END IF;

  v_is_dm := public.is_campaign_dm(p_campaign_id);

  SELECT * INTO v_ctx
  FROM public.combat_assert_active_controller(p_campaign_id, v_user_id, v_is_dm);

  v_combat := v_ctx.v_combat;
  v_turn := v_ctx.v_turn;
  v_token_id := v_ctx.v_token_id;

  IF v_token_id IS NULL THEN
    RETURN;
  END IF;

  SELECT value INTO v_token
  FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
  WHERE t.value->>'id' = v_token_id;

  IF v_token IS NULL OR COALESCE(v_token->>'kind', '') <> 'party' THEN
    RAISE EXCEPTION 'Only party characters roll death saving throws.';
  END IF;

  IF NOT COALESCE((v_turn->>'deathSaveRolled')::BOOLEAN, FALSE) THEN
    v_turn := jsonb_set(v_turn, '{deathSaveRolled}', 'true'::jsonb, TRUE);
  END IF;

  -- Sync the token's HP from the character row (a natural 20 restores 1 HP,
  -- saved to the character before this RPC runs).
  SELECT * INTO v_character
  FROM public.characters
  WHERE id = (v_token->>'characterId')::UUID AND campaign_id = p_campaign_id;

  IF FOUND THEN
    v_character_hp := (v_character.data->'combat'->>'currentHp')::INT;
    IF v_character_hp IS NOT NULL THEN
      v_tokens := (
        SELECT COALESCE(jsonb_agg(
          CASE
            WHEN t.value->>'id' = v_token_id THEN
              jsonb_set(t.value, '{currentHp}', to_jsonb(v_character_hp), TRUE)
            ELSE t.value
          END
        ), '[]'::jsonb)
        FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
      );
      v_combat := jsonb_set(v_combat, '{tokens}', v_tokens, TRUE);
    END IF;
  END IF;

  v_combat := jsonb_set(v_combat, '{turn}', v_turn, TRUE);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_combat_death_save(UUID) TO authenticated;
