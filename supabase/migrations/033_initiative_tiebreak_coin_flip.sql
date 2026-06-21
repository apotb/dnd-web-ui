-- Tie-break identical initiative totals and Dex mods with a random coin flip.

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
  ELSE
    v_initiative := jsonb_build_object(
      'status', 'collecting',
      'results', v_results,
      'order', '[]'::jsonb
    );
  END IF;

  v_combat := jsonb_set(v_combat, '{initiative}', v_initiative, true);

  v_char_data := jsonb_set(
    v_char_data,
    '{combat,pendingInitiativeRoll}',
    'null'::jsonb,
    true
  );

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;

  UPDATE public.characters
  SET data = v_char_data
  WHERE id = p_character_id;
END;
$$;
