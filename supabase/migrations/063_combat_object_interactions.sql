-- Combat equipment object interactions: consume free-then-action economy for N toggles.

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

  v_combat := jsonb_set(v_combat, '{turn}', v_turn, TRUE);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_combat_object_interactions(UUID, INT) TO authenticated;
