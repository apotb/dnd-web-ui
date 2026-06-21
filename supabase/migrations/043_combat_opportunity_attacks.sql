-- Opportunity attacks: persisted pending state, player submit/skip, turn blocking.

CREATE OR REPLACE FUNCTION public.combat_assert_opportunity_attacker(
  p_campaign_id UUID,
  p_user_id UUID,
  p_is_dm BOOLEAN,
  p_attacker_token_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_combat JSONB;
  v_token JSONB;
  v_character RECORD;
  v_pending JSONB;
  v_can_act BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.';
  END IF;

  IF NOT public.is_campaign_participant(p_campaign_id) THEN
    RAISE EXCEPTION 'You do not have access to this campaign.';
  END IF;

  SELECT combat_state INTO v_combat FROM public.campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found.';
  END IF;

  v_combat := COALESCE(v_combat, '{}'::jsonb);
  v_pending := v_combat->'pendingOpportunityAttacks';

  IF v_pending IS NULL OR v_pending = 'null'::jsonb THEN
    RAISE EXCEPTION 'No opportunity attacks are pending.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(COALESCE(v_pending->'pendingAttackerTokenIds', '[]'::jsonb)) AS t(value)
    WHERE t.value = p_attacker_token_id
  ) THEN
    RAISE EXCEPTION 'This combatant has no pending opportunity attack.';
  END IF;

  SELECT value INTO v_token
  FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
  WHERE t.value->>'id' = p_attacker_token_id;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Attacker not found.';
  END IF;

  IF COALESCE(v_token->>'kind', '') <> 'party' THEN
    RAISE EXCEPTION 'Only party members can take opportunity attacks.';
  END IF;

  IF p_is_dm THEN
    SELECT * INTO v_character
    FROM public.characters
    WHERE id = (v_token->>'characterId')::UUID AND campaign_id = p_campaign_id;
    IF FOUND AND (v_character.owner_user_id IS NULL OR v_character.owner_user_id = p_user_id) THEN
      v_can_act := TRUE;
    END IF;
  ELSE
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

  RETURN v_combat;
END;
$$;

GRANT EXECUTE ON FUNCTION public.combat_assert_opportunity_attacker(UUID, UUID, BOOLEAN, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_combat_opportunity_attack(
  p_campaign_id UUID,
  p_attacker_token_id TEXT,
  p_pending_attack JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_dm BOOLEAN;
  v_combat JSONB;
BEGIN
  v_is_dm := public.is_campaign_dm(p_campaign_id);

  v_combat := public.combat_assert_opportunity_attacker(
    p_campaign_id,
    v_user_id,
    v_is_dm,
    p_attacker_token_id
  );

  IF v_combat->'pendingAttack' IS NOT NULL AND v_combat->'pendingAttack' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'An attack is already pending.';
  END IF;

  IF COALESCE(p_pending_attack->>'attackerTokenId', '') <> p_attacker_token_id THEN
    RAISE EXCEPTION 'Attacker mismatch.';
  END IF;

  IF COALESCE(p_pending_attack->>'isOpportunityAttack', 'false') <> 'true' THEN
    RAISE EXCEPTION 'Invalid opportunity attack payload.';
  END IF;

  v_combat := jsonb_set(v_combat, '{pendingAttack}', p_pending_attack, TRUE);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_combat_opportunity_attack(UUID, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.skip_combat_opportunity_attack(
  p_campaign_id UUID,
  p_attacker_token_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_dm BOOLEAN;
  v_combat JSONB;
  v_pending JSONB;
  v_remaining JSONB := '[]'::jsonb;
BEGIN
  v_is_dm := public.is_campaign_dm(p_campaign_id);

  v_combat := public.combat_assert_opportunity_attacker(
    p_campaign_id,
    v_user_id,
    v_is_dm,
    p_attacker_token_id
  );

  v_pending := v_combat->'pendingOpportunityAttacks';

  SELECT COALESCE(jsonb_agg(t.value), '[]'::jsonb)
  INTO v_remaining
  FROM jsonb_array_elements_text(COALESCE(v_pending->'pendingAttackerTokenIds', '[]'::jsonb)) AS t(value)
  WHERE t.value <> p_attacker_token_id;

  IF jsonb_array_length(v_remaining) = 0 THEN
    v_combat := jsonb_set(v_combat, '{pendingOpportunityAttacks}', 'null'::jsonb, TRUE);
  ELSE
    v_combat := jsonb_set(
      v_combat,
      '{pendingOpportunityAttacks,pendingAttackerTokenIds}',
      v_remaining,
      TRUE
    );
  END IF;

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.skip_combat_opportunity_attack(UUID, TEXT) TO authenticated;

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
  v_pending_oa JSONB;
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

  v_pending_oa := v_combat->'pendingOpportunityAttacks';
  IF v_pending_oa IS NOT NULL
    AND v_pending_oa <> 'null'::jsonb
    AND jsonb_array_length(COALESCE(v_pending_oa->'pendingAttackerTokenIds', '[]'::jsonb)) > 0 THEN
    RAISE EXCEPTION 'Opportunity attacks must be resolved before ending this turn.';
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
  v_combat := jsonb_set(v_combat, '{pendingOpportunityAttacks}', 'null'::jsonb, TRUE);

  UPDATE public.campaigns SET combat_state = v_combat WHERE id = p_campaign_id;
END;
$$;
