-- Record bonus action used for declare-cast spells and similar player actions.

CREATE OR REPLACE FUNCTION public.record_combat_bonus_action_used(p_campaign_id UUID)
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to use combat actions.';
  END IF;

  v_is_dm := public.is_campaign_dm(p_campaign_id);

  SELECT * INTO v_ctx
  FROM public.combat_assert_active_controller(p_campaign_id, v_user_id, v_is_dm);

  v_combat := v_ctx.v_combat;
  v_turn := v_ctx.v_turn;

  IF public.combat_is_battle_over(v_combat) THEN
    v_turn := public.combat_reset_turn_economy(v_turn);
  ELSE
    IF COALESCE(v_turn->>'bonusActionUsed', 'false')::BOOLEAN THEN
      RAISE EXCEPTION 'Your bonus action has already been used this turn.';
    END IF;
    v_turn := jsonb_set(v_turn, '{bonusActionUsed}', 'true'::jsonb, TRUE);
  END IF;

  v_combat := jsonb_set(v_combat, '{turn}', v_turn, TRUE);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_combat_bonus_action_used(UUID) TO authenticated;
