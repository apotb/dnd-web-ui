-- Two-weapon fighting: track when the active combatant uses a main-hand weapon attack.

CREATE OR REPLACE FUNCTION public.record_combat_main_hand_attack(
  p_campaign_id UUID
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
  v_token JSONB;
  v_character RECORD;
  v_is_dm BOOLEAN;
  v_can_act BOOLEAN := FALSE;
  v_index INT;
  v_order_len INT;
  v_token_id TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to use combat actions.';
  END IF;

  IF NOT public.is_campaign_member(p_campaign_id) THEN
    RAISE EXCEPTION 'You are not a member of this campaign.';
  END IF;

  v_is_dm := public.is_campaign_dm(p_campaign_id);

  SELECT *
  INTO v_campaign
  FROM public.campaigns
  WHERE id = p_campaign_id;

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
      'actionUsedForTwoWeapon', FALSE
    )
  );

  IF COALESCE(v_initiative->>'status', 'none') <> 'ready' THEN
    RAISE EXCEPTION 'Battle has not started yet.';
  END IF;

  IF COALESCE(v_turn->>'active', 'false') <> 'true' THEN
    RAISE EXCEPTION 'Turn tracking is not active.';
  END IF;

  v_order := COALESCE(v_initiative->'order', '[]'::jsonb);
  v_order_len := jsonb_array_length(v_order);

  IF v_order_len = 0 THEN
    RAISE EXCEPTION 'No combatants remain in initiative order.';
  END IF;

  v_index := COALESCE((v_turn->>'index')::INT, 0);
  v_index := LEAST(GREATEST(v_index, 0), v_order_len - 1);
  v_token_id := v_order->>v_index;

  SELECT value
  INTO v_token
  FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
  WHERE t.value->>'id' = v_token_id;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Combatant not found.';
  END IF;

  IF v_is_dm THEN
    IF COALESCE(v_token->>'kind', '') IN ('enemy', 'ally') THEN
      v_can_act := TRUE;
    ELSIF COALESCE(v_token->>'kind', '') = 'party' THEN
      SELECT *
      INTO v_character
      FROM public.characters
      WHERE id = (v_token->>'characterId')::UUID
        AND campaign_id = p_campaign_id;

      IF FOUND AND v_character.owner_user_id IS NULL THEN
        v_can_act := TRUE;
      ELSIF FOUND AND v_character.owner_user_id = v_user_id THEN
        v_can_act := TRUE;
      END IF;
    END IF;
  ELSIF COALESCE(v_token->>'kind', '') = 'party' THEN
    SELECT *
    INTO v_character
    FROM public.characters
    WHERE id = (v_token->>'characterId')::UUID
      AND campaign_id = p_campaign_id;

    IF FOUND AND v_character.owner_user_id = v_user_id THEN
      v_can_act := TRUE;
    END IF;
  END IF;

  IF NOT v_can_act THEN
    RAISE EXCEPTION 'You cannot act for this combatant.';
  END IF;

  v_turn := jsonb_set(v_turn, '{actionUsedForTwoWeapon}', 'true'::jsonb, TRUE);

  v_combat := jsonb_set(v_combat, '{turn}', v_turn, TRUE);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_combat_main_hand_attack(UUID) TO authenticated;

-- Reset two-weapon tracking when advancing turns.
CREATE OR REPLACE FUNCTION public.advance_combat_turn(p_campaign_id UUID)
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
  v_token_id TEXT;
  v_token JSONB;
  v_character RECORD;
  v_is_dm BOOLEAN;
  v_can_advance BOOLEAN := FALSE;
  v_index INT;
  v_order_len INT;
  v_round INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to end a turn.';
  END IF;

  IF NOT public.is_campaign_member(p_campaign_id) THEN
    RAISE EXCEPTION 'You are not a member of this campaign.';
  END IF;

  v_is_dm := public.is_campaign_dm(p_campaign_id);

  SELECT *
  INTO v_campaign
  FROM public.campaigns
  WHERE id = p_campaign_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found.';
  END IF;

  v_combat := COALESCE(v_campaign.combat_state, '{}'::jsonb);
  v_initiative := COALESCE(v_combat->'initiative', '{}'::jsonb);
  v_turn := COALESCE(v_combat->'turn', '{}'::jsonb);

  IF COALESCE(v_initiative->>'status', 'none') <> 'ready' THEN
    RAISE EXCEPTION 'Battle has not started yet.';
  END IF;

  IF COALESCE(v_turn->>'active', 'false') <> 'true' THEN
    RAISE EXCEPTION 'Turn tracking is not active.';
  END IF;

  v_order := COALESCE(v_initiative->'order', '[]'::jsonb);
  v_order_len := jsonb_array_length(v_order);

  IF v_order_len = 0 THEN
    RAISE EXCEPTION 'No combatants remain in initiative order.';
  END IF;

  v_index := COALESCE((v_turn->>'index')::INT, 0);
  v_index := LEAST(GREATEST(v_index, 0), v_order_len - 1);
  v_token_id := v_order->>v_index;

  SELECT value
  INTO v_token
  FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
  WHERE t.value->>'id' = v_token_id;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Active combatant not found.';
  END IF;

  IF v_is_dm THEN
    IF COALESCE(v_token->>'kind', '') IN ('enemy', 'ally') THEN
      v_can_advance := TRUE;
    ELSIF COALESCE(v_token->>'kind', '') = 'party' THEN
      SELECT *
      INTO v_character
      FROM public.characters
      WHERE id = (v_token->>'characterId')::UUID
        AND campaign_id = p_campaign_id;

      IF FOUND AND v_character.owner_user_id IS NULL THEN
        v_can_advance := TRUE;
      ELSIF FOUND AND v_character.owner_user_id = v_user_id THEN
        v_can_advance := TRUE;
      END IF;
    END IF;
  ELSIF COALESCE(v_token->>'kind', '') = 'party' THEN
    SELECT *
    INTO v_character
    FROM public.characters
    WHERE id = (v_token->>'characterId')::UUID
      AND campaign_id = p_campaign_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Active combatant not found.';
    END IF;

    IF v_character.owner_user_id IS NULL THEN
      v_can_advance := v_is_dm;
    ELSE
      v_can_advance := v_character.owner_user_id = v_user_id;
    END IF;
  END IF;

  IF NOT v_can_advance THEN
    RAISE EXCEPTION 'You cannot end this turn.';
  END IF;

  v_round := COALESCE((v_turn->>'round')::INT, 1);
  v_index := v_index + 1;

  IF v_index >= v_order_len THEN
    v_index := 0;
    v_round := v_round + 1;
  END IF;

  v_turn := jsonb_build_object(
    'active', TRUE,
    'index', v_index,
    'round', v_round,
    'movementUsedFeet', 0,
    'dashUsed', FALSE,
    'actionUsedForTwoWeapon', FALSE
  );

  v_combat := jsonb_set(v_combat, '{turn}', v_turn, TRUE);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

UPDATE public.campaigns
SET combat_state = jsonb_set(
  combat_state,
  '{turn,actionUsedForTwoWeapon}',
  COALESCE(combat_state #> '{turn,actionUsedForTwoWeapon}', 'false'::jsonb),
  TRUE
)
WHERE combat_state ? 'turn';
