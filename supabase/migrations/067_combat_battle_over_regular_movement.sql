-- Battle over: use normal movement speed and allow extended (dash-zone) tiles without dash action.

DROP FUNCTION IF EXISTS public.combat_battle_over_movement_cap_ft();

CREATE OR REPLACE FUNCTION public.apply_combat_move(
  p_campaign_id UUID,
  p_token_id TEXT,
  p_x INTEGER,
  p_y INTEGER,
  p_cost_feet INTEGER,
  p_dash_consumed BOOLEAN,
  p_opportunity_attacker_token_ids TEXT[] DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_campaign RECORD;
  v_combat JSONB;
  v_initiative JSONB;
  v_turn JSONB;
  v_order JSONB;
  v_tokens JSONB;
  v_token JSONB;
  v_is_dm BOOLEAN;
  v_index INT;
  v_order_len INT;
  v_token_id TEXT;
  v_pending_oa JSONB;
  v_battle_over BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to move in combat.';
  END IF;

  IF NOT public.is_campaign_participant(p_campaign_id) THEN
    RAISE EXCEPTION 'You do not have access to this campaign.';
  END IF;

  IF p_cost_feet < 0 THEN
    RAISE EXCEPTION 'Invalid movement cost.';
  END IF;

  v_is_dm := public.is_campaign_dm(p_campaign_id);

  SELECT * INTO v_campaign FROM public.campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found.';
  END IF;

  v_combat := COALESCE(v_campaign.combat_state, '{}'::jsonb);
  v_initiative := COALESCE(v_combat->'initiative', '{}'::jsonb);
  v_turn := COALESCE(
    v_combat->'turn',
    jsonb_build_object(
      'active', FALSE,
      'index', 0,
      'round', 1,
      'movementUsedFeet', 0,
      'dashUsed', FALSE
    )
  );

  IF COALESCE(v_initiative->>'status', 'none') <> 'ready' THEN
    RAISE EXCEPTION 'Battle has not started yet.';
  END IF;

  IF COALESCE(v_turn->>'active', 'false') <> 'true' THEN
    RAISE EXCEPTION 'Turn tracking is not active.';
  END IF;

  v_battle_over := public.combat_is_battle_over(v_combat);

  v_order := COALESCE(v_initiative->'order', '[]'::jsonb);
  v_order_len := jsonb_array_length(v_order);

  IF v_order_len = 0 THEN
    RAISE EXCEPTION 'No combatants remain in initiative order.';
  END IF;

  IF NOT v_battle_over THEN
    v_index := COALESCE((v_turn->>'index')::INT, 0);
    v_index := LEAST(GREATEST(v_index, 0), v_order_len - 1);
    v_token_id := v_order->>v_index;

    IF v_token_id IS DISTINCT FROM p_token_id THEN
      RAISE EXCEPTION 'This is not the active combatant.';
    END IF;
  END IF;

  SELECT value INTO v_token
  FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
  WHERE t.value->>'id' = p_token_id;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Combatant not found.';
  END IF;

  IF NOT public.combat_can_user_act_for_token(p_campaign_id, v_user_id, v_is_dm, v_token) THEN
    RAISE EXCEPTION 'You cannot move this combatant.';
  END IF;

  IF NOT v_battle_over AND p_dash_consumed AND (
    COALESCE(v_turn->>'dashUsed', 'false')::BOOLEAN
    OR COALESCE(v_turn->>'actionUsed', 'false')::BOOLEAN
  ) THEN
    RAISE EXCEPTION 'Dash is not available.';
  END IF;

  IF NOT v_battle_over THEN
    v_pending_oa := v_combat->'pendingOpportunityAttacks';
    IF v_pending_oa IS NOT NULL
      AND v_pending_oa <> 'null'::jsonb
      AND jsonb_array_length(COALESCE(v_pending_oa->'pendingAttackerTokenIds', '[]'::jsonb)) > 0 THEN
      RAISE EXCEPTION 'Opportunity attacks must be resolved before moving again.';
    END IF;

    IF p_opportunity_attacker_token_ids IS NOT NULL
      AND array_length(p_opportunity_attacker_token_ids, 1) > 0 THEN
      v_combat := jsonb_set(
        v_combat,
        '{pendingOpportunityAttacks}',
        jsonb_build_object(
          'provokingTokenId', p_token_id,
          'pendingAttackerTokenIds', to_jsonb(p_opportunity_attacker_token_ids),
          'destination', jsonb_build_object('x', p_x, 'y', p_y),
          'costFeet', p_cost_feet,
          'dashConsumed', p_dash_consumed
        ),
        TRUE
      );

      UPDATE public.campaigns
      SET combat_state = v_combat
      WHERE id = p_campaign_id;

      RETURN;
    END IF;
  END IF;

  v_tokens := (
    SELECT COALESCE(jsonb_agg(
      CASE
        WHEN t.value->>'id' = p_token_id THEN
          jsonb_set(
            jsonb_set(t.value, '{x}', to_jsonb(p_x), TRUE),
            '{y}', to_jsonb(p_y), TRUE
          )
        ELSE t.value
      END
    ), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
  );

  IF v_battle_over THEN
    v_turn := public.combat_reset_turn_economy(v_turn);
  ELSE
    v_turn := jsonb_set(
      v_turn,
      '{movementUsedFeet}',
      to_jsonb(COALESCE((v_turn->>'movementUsedFeet')::INT, 0) + p_cost_feet),
      TRUE
    );
    v_turn := jsonb_set(
      v_turn,
      '{dashUsed}',
      to_jsonb(COALESCE(v_turn->>'dashUsed', 'false')::BOOLEAN OR p_dash_consumed),
      TRUE
    );
    v_turn := jsonb_set(
      v_turn,
      '{actionUsed}',
      to_jsonb(COALESCE(v_turn->>'actionUsed', 'false')::BOOLEAN OR p_dash_consumed),
      TRUE
    );
  END IF;

  v_combat := jsonb_set(v_combat, '{tokens}', v_tokens, TRUE);
  v_combat := jsonb_set(v_combat, '{turn}', v_turn, TRUE);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;
