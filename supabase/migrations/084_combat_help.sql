-- Help action: consume action and record a help grant for an adjacent ally.

CREATE OR REPLACE FUNCTION public.combat_tokens_melee_adjacent(
  p_token_a JSONB,
  p_token_b JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_ax INT;
  v_ay INT;
  v_aw INT;
  v_ah INT;
  v_bx INT;
  v_by INT;
  v_bw INT;
  v_bh INT;
  v_dx INT;
  v_dy INT;
  v_ex INT;
  v_ey INT;
  v_cell_ax INT;
  v_cell_ay INT;
  v_cell_bx INT;
  v_cell_by INT;
BEGIN
  IF COALESCE(p_token_a->>'placed', 'false')::BOOLEAN IS NOT TRUE
    OR COALESCE(p_token_b->>'placed', 'false')::BOOLEAN IS NOT TRUE
  THEN
    RETURN FALSE;
  END IF;

  v_ax := COALESCE((p_token_a->>'x')::INT, 0);
  v_ay := COALESCE((p_token_a->>'y')::INT, 0);
  v_aw := GREATEST(COALESCE((p_token_a->>'width')::INT, 1), 1);
  v_ah := GREATEST(COALESCE((p_token_a->>'height')::INT, 1), 1);
  v_bx := COALESCE((p_token_b->>'x')::INT, 0);
  v_by := COALESCE((p_token_b->>'y')::INT, 0);
  v_bw := GREATEST(COALESCE((p_token_b->>'width')::INT, 1), 1);
  v_bh := GREATEST(COALESCE((p_token_b->>'height')::INT, 1), 1);

  FOR v_dx IN 0..(v_aw - 1) LOOP
    FOR v_dy IN 0..(v_ah - 1) LOOP
      v_cell_ax := v_ax + v_dx;
      v_cell_ay := v_ay + v_dy;
      FOR v_ex IN 0..(v_bw - 1) LOOP
        FOR v_ey IN 0..(v_bh - 1) LOOP
          v_cell_bx := v_bx + v_ex;
          v_cell_by := v_by + v_ey;
          IF abs(v_cell_ax - v_cell_bx) <= 1
            AND abs(v_cell_ay - v_cell_by) <= 1
            AND (v_cell_ax <> v_cell_bx OR v_cell_ay <> v_cell_by)
          THEN
            RETURN TRUE;
          END IF;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.combat_tokens_are_allies(
  p_token_a JSONB,
  p_token_b JSONB
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    p_token_a->>'id' IS DISTINCT FROM p_token_b->>'id'
    AND COALESCE(p_token_a->>'kind', '') IN ('party', 'ally')
    AND COALESCE(p_token_b->>'kind', '') IN ('party', 'ally');
$$;

CREATE OR REPLACE FUNCTION public.record_combat_help(
  p_campaign_id UUID,
  p_beneficiary_token_id TEXT
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
  v_helper JSONB;
  v_beneficiary JSONB;
  v_grants JSONB;
  v_grant JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to use combat actions.';
  END IF;

  IF p_beneficiary_token_id IS NULL OR length(trim(p_beneficiary_token_id)) = 0 THEN
    RAISE EXCEPTION 'Beneficiary token is required.';
  END IF;

  v_is_dm := public.is_campaign_dm(p_campaign_id);

  SELECT * INTO v_ctx
  FROM public.combat_assert_active_controller(p_campaign_id, v_user_id, v_is_dm);

  v_combat := v_ctx.v_combat;
  v_turn := v_ctx.v_turn;

  SELECT value
  INTO v_helper
  FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
  WHERE t.value->>'id' = v_ctx.v_token_id;

  IF v_helper IS NULL THEN
    RAISE EXCEPTION 'Combatant not found.';
  END IF;

  SELECT value
  INTO v_beneficiary
  FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
  WHERE t.value->>'id' = p_beneficiary_token_id;

  IF v_beneficiary IS NULL THEN
    RAISE EXCEPTION 'Beneficiary not found.';
  END IF;

  IF NOT public.combat_tokens_are_allies(v_helper, v_beneficiary) THEN
    RAISE EXCEPTION 'You can only Help an ally.';
  END IF;

  IF NOT public.combat_tokens_melee_adjacent(v_helper, v_beneficiary) THEN
    RAISE EXCEPTION 'Beneficiary must be within 5 feet.';
  END IF;

  IF public.combat_is_battle_over(v_combat) THEN
    v_turn := public.combat_reset_turn_economy(v_turn);
  ELSE
    IF COALESCE(v_turn->>'actionUsed', 'false')::BOOLEAN THEN
      RAISE EXCEPTION 'Your action has already been used this turn.';
    END IF;
    v_turn := jsonb_set(v_turn, '{actionUsed}', 'true'::jsonb, TRUE);
  END IF;

  v_grant := jsonb_build_object(
    'helperTokenId', v_ctx.v_token_id,
    'beneficiaryTokenId', p_beneficiary_token_id
  );

  v_grants := COALESCE(v_combat->'helpGrants', '[]'::jsonb) || jsonb_build_array(v_grant);
  v_combat := jsonb_set(v_combat, '{helpGrants}', v_grants, TRUE);
  v_combat := jsonb_set(v_combat, '{turn}', v_turn, TRUE);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_combat_help(UUID, TEXT) TO authenticated;
