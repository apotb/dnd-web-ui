-- Expire Help grants at the start of the helper's next turn (not when their turn ends).

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
  v_starting_token_id TEXT;
  v_token JSONB;
  v_character RECORD;
  v_is_dm BOOLEAN;
  v_can_advance BOOLEAN := FALSE;
  v_index INT;
  v_order_len INT;
  v_round INT;
  v_pending_oa JSONB;
  v_help_grants JSONB;
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

  IF public.combat_attacker_has_pending(v_combat, v_token_id) THEN
    RAISE EXCEPTION 'Resolve pending actions before ending this turn.';
  END IF;

  SELECT value INTO v_token
  FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
  WHERE t.value->>'id' = v_token_id;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Combatant not found.';
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
    IF FOUND AND v_character.owner_user_id = v_user_id THEN
      v_can_advance := TRUE;
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

  v_starting_token_id := v_order->>v_index;

  v_help_grants := COALESCE(
    (
      SELECT jsonb_agg(entry)
      FROM jsonb_array_elements(COALESCE(v_combat->'helpGrants', '[]'::jsonb)) AS t(entry)
      WHERE entry->>'helperTokenId' IS DISTINCT FROM v_starting_token_id
    ),
    '[]'::jsonb
  );

  v_turn := jsonb_build_object(
    'active', TRUE,
    'index', v_index,
    'round', v_round,
    'movementUsedFeet', 0,
    'dashUsed', FALSE,
    'actionUsedForTwoWeapon', FALSE,
    'twoWeaponFightingUsedOffHand', NULL,
    'actionUsed', FALSE,
    'bonusActionUsed', FALSE,
    'disengageUsed', FALSE,
    'freeObjectInteractionUsed', FALSE,
    'deathSaveRolled', FALSE,
    'multiattackBranchIndex', NULL,
    'multiattackRemaining', '{}'::jsonb
  );

  v_combat := jsonb_set(v_combat, '{turn}', v_turn, TRUE);
  v_combat := jsonb_set(v_combat, '{helpGrants}', v_help_grants, TRUE);
  v_combat := jsonb_set(v_combat, '{pendingOpportunityAttacks}', 'null'::jsonb, TRUE);
  v_combat := public.combat_set_pending_attacks(v_combat, public.combat_pending_attacks(v_combat));

  UPDATE public.campaigns SET combat_state = v_combat WHERE id = p_campaign_id;
END;
$$;
