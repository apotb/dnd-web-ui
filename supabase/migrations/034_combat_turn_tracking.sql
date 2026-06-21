-- Combat turn tracking: advance turn RPC and auto-start battle when initiative completes.

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
  v_round INT;
  v_order_len INT;
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
  v_turn := COALESCE(v_combat->'turn', jsonb_build_object('active', false, 'index', 0, 'round', 1));

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

  IF v_is_dm THEN
    v_can_advance := TRUE;
  ELSE
    SELECT value
    INTO v_token
    FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
    WHERE t.value->>'id' = v_token_id;

    IF v_token IS NULL THEN
      RAISE EXCEPTION 'Active combatant not found.';
    END IF;

    IF COALESCE(v_token->>'kind', '') = 'party' THEN
      SELECT *
      INTO v_character
      FROM public.characters
      WHERE id = (v_token->>'characterId')::UUID
        AND campaign_id = p_campaign_id;

      IF FOUND AND v_character.owner_user_id = v_user_id THEN
        v_can_advance := TRUE;
      END IF;
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
    'round', v_round
  );

  v_combat := jsonb_set(v_combat, '{turn}', v_turn, TRUE);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_combat_turn(UUID) TO authenticated;

-- When the last initiative roll completes, start turn tracking automatically.
CREATE OR REPLACE FUNCTION public.submit_player_initiative_roll(
  p_campaign_id UUID,
  p_character_id UUID,
  p_roll INTEGER
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
  v_pending JSONB;
  v_token_id TEXT;
  v_modifier INT;
  v_dex_mod INT;
  v_dex_score INT;
  v_total INT;
  v_initiative JSONB;
  v_results JSONB;
  v_tokens JSONB;
  v_token JSONB;
  v_all_done BOOLEAN := TRUE;
  v_order JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to submit initiative.';
  END IF;

  IF p_roll < 1 OR p_roll > 20 THEN
    RAISE EXCEPTION 'Enter a d20 roll from 1 to 20.';
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
    RAISE EXCEPTION 'You can only submit initiative for your own character.';
  END IF;

  v_char_data := COALESCE(v_character.data, '{}'::jsonb);
  v_pending := v_char_data #> '{combat,pendingInitiativeRoll}';

  IF v_pending IS NULL OR v_pending = 'null'::jsonb THEN
    RAISE EXCEPTION 'No initiative roll is pending for this character.';
  END IF;

  v_token_id := v_pending->>'tokenId';
  v_modifier := COALESCE((v_pending->>'modifier')::INT, 0);

  SELECT *
  INTO v_campaign
  FROM public.campaigns
  WHERE id = p_campaign_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found.';
  END IF;

  v_combat := COALESCE(v_campaign.combat_state, '{}'::jsonb);
  v_initiative := COALESCE(v_combat->'initiative', '{}'::jsonb);

  IF COALESCE(v_initiative->>'status', 'none') <> 'collecting' THEN
    RAISE EXCEPTION 'Initiative is not being collected right now.';
  END IF;

  v_results := COALESCE(v_initiative->'results', '{}'::jsonb);

  IF v_results ? v_token_id THEN
    RAISE EXCEPTION 'Initiative has already been recorded for this character.';
  END IF;

  v_tokens := COALESCE(v_combat->'tokens', '[]'::jsonb);

  IF NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_tokens) AS t
    WHERE t->>'id' = v_token_id
      AND t->>'characterId' = p_character_id::text
  ) THEN
    RAISE EXCEPTION 'This character is no longer in the current battle.';
  END IF;

  v_dex_score := COALESCE((v_char_data #>> '{abilityScores,dex}')::INT, 10);
  v_dex_mod := floor((v_dex_score - 10) / 2.0)::INT;
  v_total := p_roll + v_modifier;

  v_results := v_results || jsonb_build_object(
    v_token_id,
    jsonb_build_object(
      'roll', p_roll,
      'modifier', v_modifier,
      'dexMod', v_dex_mod,
      'total', v_total
    )
  );

  FOR v_token IN SELECT value FROM jsonb_array_elements(v_tokens)
  LOOP
    IF NOT (v_results ? (v_token->>'id')) THEN
      v_all_done := FALSE;
      EXIT;
    END IF;
  END LOOP;

  IF v_all_done AND jsonb_array_length(v_tokens) > 0 THEN
    SELECT COALESCE(
      jsonb_agg(token_id ORDER BY total DESC, dex_mod DESC, random()),
      '[]'::jsonb
    )
    INTO v_order
    FROM (
      SELECT
        t->>'id' AS token_id,
        (v_results->(t->>'id')->>'total')::INT AS total,
        (v_results->(t->>'id')->>'dexMod')::INT AS dex_mod
      FROM jsonb_array_elements(v_tokens) AS t
      WHERE v_results ? (t->>'id')
    ) sorted;

    v_initiative := jsonb_build_object(
      'status', 'ready',
      'results', v_results,
      'order', v_order
    );

    v_combat := jsonb_set(
      v_combat,
      '{turn}',
      jsonb_build_object('active', TRUE, 'index', 0, 'round', 1),
      TRUE
    );
  ELSE
    v_initiative := jsonb_build_object(
      'status', 'collecting',
      'results', v_results,
      'order', '[]'::jsonb
    );
  END IF;

  v_combat := jsonb_set(v_combat, '{initiative}', v_initiative, TRUE);

  v_char_data := jsonb_set(
    v_char_data,
    '{combat,pendingInitiativeRoll}',
    'null'::jsonb,
    TRUE
  );

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;

  UPDATE public.characters
  SET data = v_char_data
  WHERE id = p_character_id;
END;
$$;

-- Backfill turn tracking for campaigns already at initiative ready.
UPDATE public.campaigns
SET combat_state = jsonb_set(
  combat_state,
  '{turn}',
  jsonb_build_object('active', TRUE, 'index', 0, 'round', 1),
  TRUE
)
WHERE COALESCE(combat_state->'initiative'->>'status', 'none') = 'ready'
  AND COALESCE(combat_state->'turn'->>'active', 'false') <> 'true';
