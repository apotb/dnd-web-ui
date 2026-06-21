-- Combat attack pending/review flow, action consumption, damageTaken tracking.

CREATE OR REPLACE FUNCTION public.combat_assert_active_controller(
  p_campaign_id UUID,
  p_user_id UUID,
  p_is_dm BOOLEAN,
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
  v_character RECORD;
  v_can_act BOOLEAN := FALSE;
  v_index INT;
  v_order_len INT;
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
      'disengageUsed', FALSE
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

  v_index := LEAST(GREATEST(COALESCE((v_turn->>'index')::INT, 0), 0), v_order_len - 1);
  v_token_id := v_order->>v_index;

  SELECT value INTO v_token
  FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
  WHERE t.value->>'id' = v_token_id;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Combatant not found.';
  END IF;

  IF p_is_dm THEN
    IF COALESCE(v_token->>'kind', '') IN ('enemy', 'ally') THEN
      v_can_act := TRUE;
    ELSIF COALESCE(v_token->>'kind', '') = 'party' THEN
      SELECT * INTO v_character
      FROM public.characters
      WHERE id = (v_token->>'characterId')::UUID AND campaign_id = p_campaign_id;
      IF FOUND AND (v_character.owner_user_id IS NULL OR v_character.owner_user_id = p_user_id) THEN
        v_can_act := TRUE;
      END IF;
    END IF;
  ELSIF COALESCE(v_token->>'kind', '') = 'party' THEN
    SELECT * INTO v_character
    FROM public.characters
    WHERE id = (v_token->>'characterId')::UUID AND campaign_id = p_campaign_id;
    IF FOUND AND v_character.owner_user_id = p_user_id THEN
      v_can_act := TRUE;
    END IF;
  END IF;

  IF NOT v_can_act THEN
    RAISE EXCEPTION 'You cannot act for this combatant.';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.combat_assert_active_controller(UUID, UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_combat_attack(
  p_campaign_id UUID,
  p_pending_attack JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_ctx RECORD;
  v_combat JSONB;
BEGIN
  SELECT * INTO v_ctx
  FROM public.combat_assert_active_controller(
    p_campaign_id,
    v_user_id,
    public.is_campaign_dm(p_campaign_id)
  );

  v_combat := v_ctx.v_combat;

  IF v_combat->'pendingAttack' IS NOT NULL AND v_combat->'pendingAttack' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'An attack is already pending.';
  END IF;

  v_combat := jsonb_set(v_combat, '{pendingAttack}', p_pending_attack, TRUE);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_combat_attack(UUID, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_combat_save_roll(
  p_campaign_id UUID,
  p_token_id TEXT,
  p_save_roll INTEGER,
  p_save_total INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_combat JSONB;
  v_pending JSONB;
  v_targets JSONB;
  v_updated_targets JSONB := '[]'::jsonb;
  v_target JSONB;
  v_all_done BOOLEAN := TRUE;
  v_is_dm BOOLEAN;
  v_character RECORD;
  v_can_submit BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;

  IF NOT public.is_campaign_participant(p_campaign_id) THEN
    RAISE EXCEPTION 'You do not have access to this campaign.';
  END IF;

  v_is_dm := public.is_campaign_dm(p_campaign_id);

  SELECT combat_state INTO v_combat FROM public.campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found.';
  END IF;

  v_combat := COALESCE(v_combat, '{}'::jsonb);
  v_pending := v_combat->'pendingAttack';

  IF v_pending IS NULL OR v_pending = 'null'::jsonb THEN
    RAISE EXCEPTION 'No pending attack.';
  END IF;

  IF COALESCE(v_pending->>'status', '') <> 'awaiting-saves' THEN
    RAISE EXCEPTION 'Attack is not awaiting saves.';
  END IF;

  SELECT value INTO v_target
  FROM jsonb_array_elements(COALESCE(v_pending->'targets', '[]'::jsonb)) AS t(value)
  WHERE t.value->>'tokenId' = p_token_id;

  IF v_target IS NULL THEN
    RAISE EXCEPTION 'Target not in pending attack.';
  END IF;

  IF COALESCE((v_target->>'needsDmSave')::BOOLEAN, FALSE) THEN
    IF NOT v_is_dm THEN
      RAISE EXCEPTION 'Only the DM can submit this save.';
    END IF;
    v_can_submit := TRUE;
  ELSE
    SELECT c.* INTO v_character
    FROM public.characters c
    JOIN jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
      ON t.value->>'characterId' = c.id::text
    WHERE t.value->>'id' = p_token_id AND c.campaign_id = p_campaign_id;

    IF FOUND AND v_character.owner_user_id = v_user_id THEN
      v_can_submit := TRUE;
    END IF;
  END IF;

  IF NOT v_can_submit THEN
    RAISE EXCEPTION 'You cannot submit a save for this target.';
  END IF;

  v_targets := COALESCE(v_pending->'targets', '[]'::jsonb);

  SELECT COALESCE(jsonb_agg(
    CASE
      WHEN t.value->>'tokenId' = p_token_id THEN
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(t.value, '{saveRoll}', to_jsonb(p_save_roll), TRUE),
              '{saveTotal}', to_jsonb(p_save_total), TRUE
            ),
            '{saveSubmitted}', 'true'::jsonb, TRUE
          ),
          '{saveSucceeded}',
          to_jsonb(
            p_save_total >= COALESCE((v_pending->>'saveDc')::INT, 0)
          ),
          TRUE
        )
      ELSE t.value
    END
  ), '[]'::jsonb)
  INTO v_updated_targets
  FROM jsonb_array_elements(v_targets) AS t(value);

  SELECT NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_updated_targets) AS t(value)
    WHERE COALESCE((t.value->>'requiresSave')::BOOLEAN, FALSE)
      AND NOT COALESCE((t.value->>'saveSubmitted')::BOOLEAN, FALSE)
  )
  INTO v_all_done;

  v_pending := jsonb_set(v_pending, '{targets}', v_updated_targets, TRUE);

  IF v_all_done THEN
    v_pending := jsonb_set(v_pending, '{status}', '"awaiting-dm-review"'::jsonb, TRUE);
  END IF;

  v_combat := jsonb_set(v_combat, '{pendingAttack}', v_pending, TRUE);

  UPDATE public.campaigns SET combat_state = v_combat WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_combat_save_roll(UUID, TEXT, INTEGER, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_combat_attack(p_campaign_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_combat JSONB;
  v_is_dm BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;

  IF NOT public.is_campaign_participant(p_campaign_id) THEN
    RAISE EXCEPTION 'You do not have access to this campaign.';
  END IF;

  v_is_dm := public.is_campaign_dm(p_campaign_id);

  SELECT combat_state INTO v_combat FROM public.campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found.';
  END IF;

  v_combat := COALESCE(v_combat, '{}'::jsonb);

  IF v_combat->'pendingAttack' IS NULL OR v_combat->'pendingAttack' = 'null'::jsonb THEN
    RETURN;
  END IF;

  IF NOT v_is_dm THEN
    PERFORM * FROM public.combat_assert_active_controller(p_campaign_id, v_user_id, FALSE);
  END IF;

  v_combat := jsonb_set(v_combat, '{pendingAttack}', 'null'::jsonb, TRUE);

  UPDATE public.campaigns SET combat_state = v_combat WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_combat_attack(UUID) TO authenticated;

-- advance_combat_turn: reset new action flags and clear pending attack
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

  IF NOT public.is_campaign_participant(p_campaign_id) THEN
    RAISE EXCEPTION 'You do not have access to this campaign.';
  END IF;

  v_is_dm := public.is_campaign_dm(p_campaign_id);

  SELECT * INTO v_campaign FROM public.campaigns WHERE id = p_campaign_id;
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

  v_index := LEAST(GREATEST(COALESCE((v_turn->>'index')::INT, 0), 0), v_order_len - 1);
  v_token_id := v_order->>v_index;

  SELECT value INTO v_token
  FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
  WHERE t.value->>'id' = v_token_id;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Active combatant not found.';
  END IF;

  IF v_is_dm THEN
    IF COALESCE(v_token->>'kind', '') IN ('enemy', 'ally') THEN
      v_can_advance := TRUE;
    ELSIF COALESCE(v_token->>'kind', '') = 'party' THEN
      SELECT * INTO v_character
      FROM public.characters
      WHERE id = (v_token->>'characterId')::UUID AND campaign_id = p_campaign_id;
      IF FOUND AND (v_character.owner_user_id IS NULL OR v_character.owner_user_id = v_user_id) THEN
        v_can_advance := TRUE;
      END IF;
    END IF;
  ELSIF COALESCE(v_token->>'kind', '') = 'party' THEN
    SELECT * INTO v_character
    FROM public.characters
    WHERE id = (v_token->>'characterId')::UUID AND campaign_id = p_campaign_id;
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
  v_index := COALESCE((v_turn->>'index')::INT, 0) + 1;

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
    'actionUsedForTwoWeapon', FALSE,
    'actionUsed', FALSE,
    'bonusActionUsed', FALSE,
    'disengageUsed', FALSE
  );

  v_combat := jsonb_set(v_combat, '{turn}', v_turn, TRUE);
  v_combat := jsonb_set(v_combat, '{pendingAttack}', 'null'::jsonb, TRUE);

  UPDATE public.campaigns SET combat_state = v_combat WHERE id = p_campaign_id;
END;
$$;
