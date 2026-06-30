-- Battle over phase: free token control, economy reset after moves/actions, leave area.

DROP FUNCTION IF EXISTS public.combat_assert_active_controller(UUID, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.pickup_combat_object(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.combat_is_living_enemy(p_token JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_token->>'kind', '') = 'enemy'
    AND COALESCE((p_token->>'currentHp')::INT, 0) > 0;
$$;

CREATE OR REPLACE FUNCTION public.combat_is_battle_over(p_combat JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_initiative JSONB;
  v_turn JSONB;
  v_order_len INT;
  v_token JSONB;
BEGIN
  v_initiative := COALESCE(p_combat->'initiative', '{}'::jsonb);
  v_turn := COALESCE(p_combat->'turn', '{}'::jsonb);
  v_order_len := jsonb_array_length(COALESCE(v_initiative->'order', '[]'::jsonb));

  IF COALESCE(v_initiative->>'status', 'none') <> 'ready' THEN
    RETURN FALSE;
  END IF;
  IF COALESCE(v_turn->>'active', 'false') <> 'true' THEN
    RETURN FALSE;
  END IF;
  IF v_order_len = 0 THEN
    RETURN FALSE;
  END IF;

  FOR v_token IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_combat->'tokens', '[]'::jsonb)) AS t(value)
  LOOP
    IF public.combat_is_living_enemy(v_token) THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.combat_is_token_on_edge(
  p_token JSONB,
  p_grid_width INT,
  p_grid_height INT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE((p_token->>'x')::INT, 0) = 0
    OR COALESCE((p_token->>'y')::INT, 0) = 0
    OR COALESCE((p_token->>'x')::INT, 0) + GREATEST(COALESCE((p_token->>'width')::INT, 1), 1) >= p_grid_width
    OR COALESCE((p_token->>'y')::INT, 0) + GREATEST(COALESCE((p_token->>'height')::INT, 1), 1) >= p_grid_height;
$$;

CREATE OR REPLACE FUNCTION public.combat_reset_turn_economy(p_turn JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  p_turn := jsonb_set(p_turn, '{movementUsedFeet}', '0'::jsonb, TRUE);
  p_turn := jsonb_set(p_turn, '{dashUsed}', 'false'::jsonb, TRUE);
  p_turn := jsonb_set(p_turn, '{actionUsedForTwoWeapon}', 'false'::jsonb, TRUE);
  p_turn := jsonb_set(p_turn, '{twoWeaponFightingUsedOffHand}', 'null'::jsonb, TRUE);
  p_turn := jsonb_set(p_turn, '{actionUsed}', 'false'::jsonb, TRUE);
  p_turn := jsonb_set(p_turn, '{bonusActionUsed}', 'false'::jsonb, TRUE);
  p_turn := jsonb_set(p_turn, '{disengageUsed}', 'false'::jsonb, TRUE);
  p_turn := jsonb_set(p_turn, '{freeObjectInteractionUsed}', 'false'::jsonb, TRUE);
  RETURN p_turn;
END;
$$;

CREATE OR REPLACE FUNCTION public.combat_can_user_act_for_token(
  p_campaign_id UUID,
  p_user_id UUID,
  p_is_dm BOOLEAN,
  p_token JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_character RECORD;
BEGIN
  IF p_token IS NULL THEN
    RETURN FALSE;
  END IF;

  IF COALESCE(p_token->>'kind', '') IN ('enemy', 'ally') THEN
    RETURN p_is_dm;
  END IF;

  IF COALESCE(p_token->>'kind', '') = 'party' THEN
    SELECT *
    INTO v_character
    FROM public.characters
    WHERE id = (p_token->>'characterId')::UUID
      AND campaign_id = p_campaign_id;

    IF NOT FOUND THEN
      RETURN FALSE;
    END IF;

    IF p_is_dm THEN
      RETURN v_character.owner_user_id IS NULL OR v_character.owner_user_id = p_user_id;
    END IF;

    RETURN v_character.owner_user_id = p_user_id;
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.combat_assert_active_controller(
  p_campaign_id UUID,
  p_user_id UUID,
  p_is_dm BOOLEAN,
  p_actor_token_id TEXT DEFAULT NULL,
  OUT v_combat JSONB,
  OUT v_turn JSONB,
  OUT v_token_id TEXT
)
RETURNS RECORD
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign RECORD;
  v_initiative JSONB;
  v_order JSONB;
  v_token JSONB;
  v_index INT;
  v_order_len INT;
  v_battle_over BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to use combat actions.';
  END IF;

  IF NOT public.is_campaign_participant(p_campaign_id) THEN
    RAISE EXCEPTION 'You do not have access to this campaign.';
  END IF;

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
      'dashUsed', FALSE,
      'actionUsedForTwoWeapon', FALSE,
      'actionUsed', FALSE,
      'bonusActionUsed', FALSE,
      'disengageUsed', FALSE,
      'freeObjectInteractionUsed', FALSE
    )
  );

  IF COALESCE(v_initiative->>'status', 'none') <> 'ready' THEN
    RAISE EXCEPTION 'Battle has not started yet.';
  END IF;

  IF COALESCE(v_turn->>'active', 'false') <> 'true' THEN
    RAISE EXCEPTION 'Turn tracking is not active.';
  END IF;

  v_battle_over := public.combat_is_battle_over(v_combat);

  IF v_battle_over THEN
    IF p_actor_token_id IS NOT NULL THEN
      v_token_id := p_actor_token_id;
      SELECT value INTO v_token
      FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
      WHERE t.value->>'id' = v_token_id;

      IF v_token IS NULL THEN
        RAISE EXCEPTION 'Combatant not found.';
      END IF;

      IF NOT public.combat_can_user_act_for_token(p_campaign_id, p_user_id, p_is_dm, v_token) THEN
        RAISE EXCEPTION 'You cannot act for this combatant.';
      END IF;
    ELSE
      v_token_id := NULL;
    END IF;
    RETURN;
  END IF;

  v_order := COALESCE(v_initiative->'order', '[]'::jsonb);
  v_order_len := jsonb_array_length(v_order);
  IF v_order_len = 0 THEN
    RAISE EXCEPTION 'No combatants remain in initiative order.';
  END IF;

  v_index := LEAST(GREATEST(COALESCE((v_turn->>'index')::INT, 0), 0), v_order_len - 1);
  v_token_id := v_order->>v_index;

  SELECT value INTO v_token
  FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
  WHERE t.value->>'id' = v_token_id;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Combatant not found.';
  END IF;

  IF NOT public.combat_can_user_act_for_token(p_campaign_id, p_user_id, p_is_dm, v_token) THEN
    RAISE EXCEPTION 'You cannot act for this combatant.';
  END IF;
END;
$$;

-- apply_combat_move: skip active-combatant check when battle over; reset economy after move.

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
  v_can_move BOOLEAN := FALSE;
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

CREATE OR REPLACE FUNCTION public.leave_combat_area(
  p_campaign_id UUID,
  p_token_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_dm BOOLEAN;
  v_campaign RECORD;
  v_combat JSONB;
  v_token JSONB;
  v_tokens JSONB;
  v_next_tokens JSONB := '[]'::jsonb;
  v_entry JSONB;
  v_initiative JSONB;
  v_turn JSONB;
  v_order JSONB;
  v_results JSONB;
  v_excluded JSONB;
  v_character_id TEXT;
  v_grid_width INT;
  v_grid_height INT;
  v_removed_index INT;
  v_next_index INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to leave the area.';
  END IF;

  IF NOT public.is_campaign_participant(p_campaign_id) THEN
    RAISE EXCEPTION 'You do not have access to this campaign.';
  END IF;

  v_is_dm := public.is_campaign_dm(p_campaign_id);

  SELECT * INTO v_campaign FROM public.campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found.';
  END IF;

  v_combat := COALESCE(v_campaign.combat_state, '{}'::jsonb);

  IF NOT public.combat_is_battle_over(v_combat) THEN
    RAISE EXCEPTION 'Battle is not over yet.';
  END IF;

  SELECT value INTO v_token
  FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
  WHERE t.value->>'id' = p_token_id;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Combatant not found.';
  END IF;

  IF COALESCE(v_token->>'kind', '') <> 'party' THEN
    RAISE EXCEPTION 'Only party characters can leave the area.';
  END IF;

  v_grid_width := COALESCE((v_combat->>'gridWidth')::INT, 20);
  v_grid_height := COALESCE((v_combat->>'gridHeight')::INT, 20);

  IF NOT public.combat_is_token_on_edge(v_token, v_grid_width, v_grid_height) THEN
    RAISE EXCEPTION 'You must be on the edge of the map to leave.';
  END IF;

  IF NOT public.combat_can_user_act_for_token(p_campaign_id, v_user_id, v_is_dm, v_token) THEN
    RAISE EXCEPTION 'You cannot remove this combatant.';
  END IF;

  v_character_id := NULLIF(TRIM(COALESCE(v_token->>'characterId', '')), '');
  v_excluded := COALESCE(v_combat->'excludedPartyCharacterIds', '[]'::jsonb);
  IF v_character_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(v_excluded) AS e(value)
      WHERE e.value = v_character_id
    ) THEN
    v_excluded := v_excluded || to_jsonb(v_character_id);
  END IF;

  v_tokens := COALESCE(v_combat->'tokens', '[]'::jsonb);
  FOR v_entry IN SELECT value FROM jsonb_array_elements(v_tokens) AS t(value)
  LOOP
    IF v_entry->>'id' <> p_token_id THEN
      v_next_tokens := v_next_tokens || jsonb_build_array(v_entry);
    END IF;
  END LOOP;

  v_initiative := COALESCE(v_combat->'initiative', '{}'::jsonb);
  v_turn := COALESCE(v_combat->'turn', '{}'::jsonb);
  v_results := COALESCE(v_initiative->'results', '{}'::jsonb) - p_token_id;
  v_order := (
    SELECT COALESCE(jsonb_agg(to_jsonb(ord.value)), '[]'::jsonb)
    FROM jsonb_array_elements_text(COALESCE(v_initiative->'order', '[]'::jsonb)) AS ord(value)
    WHERE ord.value <> p_token_id
  );

  IF jsonb_array_length(v_order) = 0 THEN
    v_initiative := jsonb_build_object('status', 'none', 'results', '{}'::jsonb, 'order', '[]'::jsonb);
    v_turn := jsonb_set(
      jsonb_set(v_turn, '{active}', 'false'::jsonb, TRUE),
      '{index}', '0'::jsonb, TRUE
    );
    v_turn := public.combat_reset_turn_economy(v_turn);
  ELSE
    v_removed_index := (
      SELECT ord.ordinality - 1
      FROM jsonb_array_elements_text(COALESCE(v_initiative->'order', '[]'::jsonb))
        WITH ORDINALITY AS ord(value, ordinality)
      WHERE ord.value = p_token_id
      LIMIT 1
    );

    v_next_index := COALESCE((v_turn->>'index')::INT, 0);
    IF v_removed_index IS NOT NULL THEN
      IF v_removed_index < v_next_index THEN
        v_next_index := GREATEST(0, v_next_index - 1);
      ELSIF v_removed_index = v_next_index THEN
        v_next_index := LEAST(v_next_index, jsonb_array_length(v_order) - 1);
      END IF;
    END IF;
    v_next_index := LEAST(GREATEST(v_next_index, 0), GREATEST(jsonb_array_length(v_order) - 1, 0));

    v_initiative := jsonb_set(
      jsonb_set(v_initiative, '{results}', v_results, TRUE),
      '{order}', v_order, TRUE
    );
    v_turn := jsonb_set(v_turn, '{index}', to_jsonb(v_next_index), TRUE);
  END IF;

  v_combat := jsonb_set(v_combat, '{tokens}', v_next_tokens, TRUE);
  v_combat := jsonb_set(v_combat, '{excludedPartyCharacterIds}', v_excluded, TRUE);
  v_combat := jsonb_set(v_combat, '{initiative}', v_initiative, TRUE);
  v_combat := jsonb_set(v_combat, '{turn}', v_turn, TRUE);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_combat_area(UUID, TEXT) TO authenticated;

-- Standard action RPCs: allow during battle over and reset economy afterward.

CREATE OR REPLACE FUNCTION public.record_combat_disengage(p_campaign_id UUID)
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to use combat actions.';
  END IF;

  v_is_dm := public.is_campaign_dm(p_campaign_id);

  SELECT * INTO v_ctx
  FROM public.combat_assert_active_controller(p_campaign_id, v_user_id, v_is_dm);

  v_combat := v_ctx.v_combat;
  v_turn := v_ctx.v_turn;

  IF public.combat_is_battle_over(v_combat) THEN
    v_turn := public.combat_reset_turn_economy(v_turn);
  ELSE
    IF COALESCE(v_turn->>'disengageUsed', 'false')::BOOLEAN THEN
      RAISE EXCEPTION 'Disengage has already been used this turn.';
    END IF;
    v_turn := jsonb_set(v_turn, '{disengageUsed}', 'true'::jsonb, TRUE);
    v_turn := jsonb_set(v_turn, '{actionUsed}', 'true'::jsonb, TRUE);
  END IF;

  v_combat := jsonb_set(v_combat, '{turn}', v_turn, TRUE);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_combat_dash(p_campaign_id UUID)
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to use combat actions.';
  END IF;

  v_is_dm := public.is_campaign_dm(p_campaign_id);

  SELECT * INTO v_ctx
  FROM public.combat_assert_active_controller(p_campaign_id, v_user_id, v_is_dm);

  v_combat := v_ctx.v_combat;
  v_turn := v_ctx.v_turn;

  IF public.combat_is_battle_over(v_combat) THEN
    v_turn := public.combat_reset_turn_economy(v_turn);
  ELSE
    IF COALESCE(v_turn->>'dashUsed', 'false')::BOOLEAN THEN
      RAISE EXCEPTION 'Dash has already been used this turn.';
    END IF;
    IF COALESCE(v_turn->>'actionUsed', 'false')::BOOLEAN THEN
      RAISE EXCEPTION 'Your action has already been used this turn.';
    END IF;
    v_turn := jsonb_set(v_turn, '{dashUsed}', 'true'::jsonb, TRUE);
    v_turn := jsonb_set(v_turn, '{actionUsed}', 'true'::jsonb, TRUE);
  END IF;

  v_combat := jsonb_set(v_combat, '{turn}', v_turn, TRUE);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_combat_action_used(p_campaign_id UUID)
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to use combat actions.';
  END IF;

  v_is_dm := public.is_campaign_dm(p_campaign_id);

  SELECT * INTO v_ctx
  FROM public.combat_assert_active_controller(p_campaign_id, v_user_id, v_is_dm);

  v_combat := v_ctx.v_combat;
  v_turn := v_ctx.v_turn;

  IF public.combat_is_battle_over(v_combat) THEN
    v_turn := public.combat_reset_turn_economy(v_turn);
  ELSE
    IF COALESCE(v_turn->>'actionUsed', 'false')::BOOLEAN THEN
      RAISE EXCEPTION 'Your action has already been used this turn.';
    END IF;
    v_turn := jsonb_set(v_turn, '{actionUsed}', 'true'::jsonb, TRUE);
  END IF;

  v_combat := jsonb_set(v_combat, '{turn}', v_turn, TRUE);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.pickup_combat_object(
  p_campaign_id UUID,
  p_marker_id TEXT,
  p_actor_token_id TEXT DEFAULT NULL
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
  v_token_id TEXT;
  v_actor JSONB;
  v_marker JSONB;
  v_tokens JSONB;
  v_next_tokens JSONB := '[]'::jsonb;
  v_entry JSONB;
  v_battle_over BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to pick up objects.';
  END IF;

  v_is_dm := public.is_campaign_dm(p_campaign_id);

  SELECT * INTO v_ctx
  FROM public.combat_assert_active_controller(
    p_campaign_id,
    v_user_id,
    v_is_dm,
    p_actor_token_id
  );

  v_combat := v_ctx.v_combat;
  v_turn := v_ctx.v_turn;
  v_token_id := COALESCE(p_actor_token_id, v_ctx.v_token_id);
  v_battle_over := public.combat_is_battle_over(v_combat);

  IF v_token_id IS NULL THEN
    RAISE EXCEPTION 'Combatant not found.';
  END IF;

  SELECT value INTO v_actor
  FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
  WHERE t.value->>'id' = v_token_id;

  IF v_actor IS NULL OR COALESCE(v_actor->>'kind', '') <> 'party' THEN
    RAISE EXCEPTION 'Only party characters can pick up objects.';
  END IF;

  SELECT value INTO v_marker
  FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
  WHERE t.value->>'id' = p_marker_id;

  IF v_marker IS NULL OR COALESCE(v_marker->>'kind', '') <> 'marker' THEN
    RAISE EXCEPTION 'Marker not found.';
  END IF;

  IF COALESCE(v_marker->>'isObject', 'false')::BOOLEAN IS NOT TRUE
    OR COALESCE(v_marker->>'itemPickup', 'false')::BOOLEAN IS NOT TRUE
    OR NULLIF(TRIM(COALESCE(v_marker->>'pickupItemId', '')), '') IS NULL THEN
    RAISE EXCEPTION 'That marker cannot be picked up.';
  END IF;

  IF NOT public.combat_tokens_adjacent(v_actor, v_marker) THEN
    RAISE EXCEPTION 'You must be adjacent to pick up that object.';
  END IF;

  IF v_battle_over THEN
    v_turn := public.combat_reset_turn_economy(v_turn);
  ELSIF NOT COALESCE(v_turn->>'freeObjectInteractionUsed', 'false')::BOOLEAN THEN
    v_turn := jsonb_set(v_turn, '{freeObjectInteractionUsed}', 'true'::jsonb, TRUE);
  ELSIF NOT COALESCE(v_turn->>'actionUsed', 'false')::BOOLEAN THEN
    v_turn := jsonb_set(v_turn, '{actionUsed}', 'true'::jsonb, TRUE);
  ELSE
    RAISE EXCEPTION 'You have already used your object interactions this turn.';
  END IF;

  v_tokens := COALESCE(v_combat->'tokens', '[]'::jsonb);
  FOR v_entry IN SELECT value FROM jsonb_array_elements(v_tokens) AS t(value)
  LOOP
    IF v_entry->>'id' <> p_marker_id THEN
      v_next_tokens := v_next_tokens || jsonb_build_array(v_entry);
    END IF;
  END LOOP;

  v_combat := jsonb_set(v_combat, '{tokens}', v_next_tokens, TRUE);
  v_combat := jsonb_set(v_combat, '{turn}', v_turn, TRUE);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_combat_object_interactions(
  p_campaign_id UUID,
  p_count INT
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
  v_free_used BOOLEAN;
  v_action_used BOOLEAN;
  v_i INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to change equipment.';
  END IF;

  IF p_count IS NULL OR p_count < 1 OR p_count > 2 THEN
    RAISE EXCEPTION 'Invalid object interaction count.';
  END IF;

  v_is_dm := public.is_campaign_dm(p_campaign_id);

  SELECT * INTO v_ctx
  FROM public.combat_assert_active_controller(p_campaign_id, v_user_id, v_is_dm);

  v_combat := v_ctx.v_combat;
  v_turn := v_ctx.v_turn;

  IF public.combat_is_battle_over(v_combat) THEN
    v_turn := public.combat_reset_turn_economy(v_turn);
  ELSE
    v_free_used := COALESCE(v_turn->>'freeObjectInteractionUsed', 'false')::BOOLEAN;
    v_action_used := COALESCE(v_turn->>'actionUsed', 'false')::BOOLEAN;

    IF v_free_used AND v_action_used THEN
      RAISE EXCEPTION 'You have already used your object interactions this turn.';
    END IF;

    IF p_count = 2 AND (v_free_used OR v_action_used) THEN
      RAISE EXCEPTION 'That many equipment changes require your free object interaction and your action.';
    END IF;

    FOR v_i IN 1..p_count LOOP
      v_free_used := COALESCE(v_turn->>'freeObjectInteractionUsed', 'false')::BOOLEAN;
      v_action_used := COALESCE(v_turn->>'actionUsed', 'false')::BOOLEAN;

      IF NOT v_free_used THEN
        v_turn := jsonb_set(v_turn, '{freeObjectInteractionUsed}', 'true'::jsonb, TRUE);
      ELSIF NOT v_action_used THEN
        v_turn := jsonb_set(v_turn, '{actionUsed}', 'true'::jsonb, TRUE);
      ELSE
        RAISE EXCEPTION 'You have already used your action this turn.';
      END IF;
    END LOOP;
  END IF;

  v_combat := jsonb_set(v_combat, '{turn}', v_turn, TRUE);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.combat_assert_active_controller(UUID, UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pickup_combat_object(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_combat_area(UUID, TEXT) TO authenticated;
