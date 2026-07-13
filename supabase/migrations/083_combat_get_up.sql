-- Get Up: spend movement to stand from prone (party characters via RPC; enemy prone cleared in combat_state for DM).

CREATE OR REPLACE FUNCTION public.record_combat_get_up(
  p_campaign_id UUID,
  p_cost_feet INTEGER
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
  v_token_id TEXT;
  v_character RECORD;
  v_conditions JSONB;
  v_speed INT;
  v_movement_used INT;
  v_dash_used BOOLEAN;
  v_movement_cap INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to use combat actions.';
  END IF;

  IF p_cost_feet IS NULL OR p_cost_feet < 1 THEN
    RAISE EXCEPTION 'Invalid Get Up movement cost.';
  END IF;

  v_is_dm := public.is_campaign_dm(p_campaign_id);

  SELECT * INTO v_ctx
  FROM public.combat_assert_active_controller(p_campaign_id, v_user_id, v_is_dm);

  v_combat := v_ctx.v_combat;
  v_turn := v_ctx.v_turn;
  v_token_id := v_ctx.v_token_id;

  IF public.combat_is_battle_over(v_combat) THEN
    RAISE EXCEPTION 'Get Up is not available after battle ends.';
  END IF;

  SELECT value INTO v_token
  FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
  WHERE t.value->>'id' = v_token_id;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Combatant not found.';
  END IF;

  IF COALESCE(v_token->>'kind', '') = 'party' THEN
    SELECT * INTO v_character
    FROM public.characters
    WHERE id = (v_token->>'characterId')::UUID AND campaign_id = p_campaign_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Character not found.';
    END IF;

    v_conditions := COALESCE(v_character.data->'combat'->'conditions', '[]'::jsonb);
    IF NOT (v_conditions @> '["prone"]'::jsonb) THEN
      RAISE EXCEPTION 'You are not prone.';
    END IF;

    v_speed := GREATEST(
      COALESCE((v_character.data->'combat'->>'speed')::INT, 30),
      1
    );
  ELSIF COALESCE(v_token->>'kind', '') = 'enemy' AND v_is_dm THEN
    v_conditions := COALESCE(v_token->'conditions', '[]'::jsonb);
    IF NOT (v_conditions @> '["prone"]'::jsonb) THEN
      RAISE EXCEPTION 'This combatant is not prone.';
    END IF;

    v_speed := 30;
  ELSE
    RAISE EXCEPTION 'Get Up is not available for this combatant.';
  END IF;

  IF p_cost_feet > GREATEST(5, v_speed / 2) THEN
    RAISE EXCEPTION 'Invalid Get Up movement cost.';
  END IF;

  v_movement_used := COALESCE((v_turn->>'movementUsedFeet')::INT, 0);
  v_dash_used := COALESCE(v_turn->>'dashUsed', 'false')::BOOLEAN;
  v_movement_cap := CASE WHEN v_dash_used THEN v_speed * 2 ELSE v_speed END;

  IF v_movement_used + p_cost_feet > v_movement_cap THEN
    RAISE EXCEPTION 'Not enough movement remaining.';
  END IF;

  v_turn := jsonb_set(
    v_turn,
    '{movementUsedFeet}',
    to_jsonb(v_movement_used + p_cost_feet),
    TRUE
  );

  IF COALESCE(v_token->>'kind', '') = 'enemy' THEN
    v_combat := jsonb_set(
      v_combat,
      '{tokens}',
      (
        SELECT COALESCE(jsonb_agg(
          CASE
            WHEN t.value->>'id' = v_token_id THEN
              jsonb_set(
                t.value,
                '{conditions}',
                (
                  SELECT COALESCE(jsonb_agg(to_jsonb(slug)), '[]'::jsonb)
                  FROM jsonb_array_elements_text(
                    COALESCE(t.value->'conditions', '[]'::jsonb)
                  ) AS slug
                  WHERE slug <> 'prone'
                ),
                TRUE
              )
            ELSE t.value
          END
        ), '[]'::jsonb)
        FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
      ),
      TRUE
    );
  END IF;

  v_combat := jsonb_set(v_combat, '{turn}', v_turn, TRUE);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_combat_get_up(UUID, INTEGER) TO authenticated;
