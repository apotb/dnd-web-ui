-- Defer provoking movement until all opportunity attacks are resolved.

CREATE OR REPLACE FUNCTION public.combat_finalize_pending_opportunity_move(p_combat JSONB)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_pending JSONB;
  v_dest JSONB;
  v_provoking_id TEXT;
  v_cost INT;
  v_dash BOOLEAN;
  v_turn JSONB;
  v_used_feet INT;
  v_dash_used BOOLEAN;
  v_action_used BOOLEAN;
BEGIN
  v_pending := p_combat->'pendingOpportunityAttacks';
  IF v_pending IS NULL OR v_pending = 'null'::jsonb THEN
    RETURN p_combat;
  END IF;

  v_dest := v_pending->'destination';
  IF v_dest IS NULL THEN
    RETURN jsonb_set(p_combat, '{pendingOpportunityAttacks}', 'null'::jsonb, TRUE);
  END IF;

  v_provoking_id := v_pending->>'provokingTokenId';
  v_cost := COALESCE((v_pending->>'costFeet')::INT, 0);
  v_dash := COALESCE((v_pending->>'dashConsumed')::BOOLEAN, FALSE);
  v_turn := COALESCE(p_combat->'turn', '{}'::jsonb);

  p_combat := jsonb_set(
    p_combat,
    '{tokens}',
    (
      SELECT COALESCE(jsonb_agg(
        CASE
          WHEN t.value->>'id' = v_provoking_id THEN
            jsonb_set(
              jsonb_set(t.value, '{x}', v_dest->'x', TRUE),
              '{y}', v_dest->'y', TRUE
            )
          ELSE t.value
        END
      ), '[]'::jsonb)
      FROM jsonb_array_elements(COALESCE(p_combat->'tokens', '[]'::jsonb)) AS t(value)
    ),
    TRUE
  );

  v_used_feet := COALESCE((v_turn->>'movementUsedFeet')::INT, 0) + v_cost;
  v_dash_used := COALESCE((v_turn->>'dashUsed')::BOOLEAN, FALSE) OR v_dash;
  v_action_used := COALESCE((v_turn->>'actionUsed')::BOOLEAN, FALSE) OR v_dash;

  v_turn := jsonb_set(v_turn, '{movementUsedFeet}', to_jsonb(v_used_feet), TRUE);
  v_turn := jsonb_set(v_turn, '{dashUsed}', to_jsonb(v_dash_used), TRUE);
  v_turn := jsonb_set(v_turn, '{actionUsed}', to_jsonb(v_action_used), TRUE);

  p_combat := jsonb_set(p_combat, '{turn}', v_turn, TRUE);
  p_combat := jsonb_set(p_combat, '{pendingOpportunityAttacks}', 'null'::jsonb, TRUE);

  RETURN p_combat;
END;
$$;

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
    v_combat := public.combat_finalize_pending_opportunity_move(v_combat);
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
