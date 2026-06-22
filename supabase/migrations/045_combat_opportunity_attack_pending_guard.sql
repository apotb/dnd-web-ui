-- Block skip/submit while a submitted opportunity attack is awaiting resolution.

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
  v_pending_attack JSONB;
  v_remaining JSONB := '[]'::jsonb;
BEGIN
  v_is_dm := public.is_campaign_dm(p_campaign_id);

  v_combat := public.combat_assert_opportunity_attacker(
    p_campaign_id,
    v_user_id,
    v_is_dm,
    p_attacker_token_id
  );

  v_pending_attack := v_combat->'pendingAttack';
  IF v_pending_attack IS NOT NULL
    AND v_pending_attack <> 'null'::jsonb
    AND COALESCE(v_pending_attack->>'isOpportunityAttack', 'false') = 'true'
    AND v_pending_attack->>'attackerTokenId' = p_attacker_token_id THEN
    RAISE EXCEPTION 'Your opportunity attack is already pending.';
  END IF;

  IF v_pending_attack IS NOT NULL AND v_pending_attack <> 'null'::jsonb THEN
    RAISE EXCEPTION 'An attack is already pending.';
  END IF;

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
