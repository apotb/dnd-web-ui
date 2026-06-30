-- Combat feature effects (e.g. Tortle Shell Defense).

CREATE OR REPLACE FUNCTION public.combat_token_has_effect(
  p_token JSONB,
  p_effect_id TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    p_token->'activeEffects' ? p_effect_id,
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.combat_set_token_effect(
  p_tokens JSONB,
  p_token_id TEXT,
  p_effect_id TEXT,
  p_add BOOLEAN
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN t.value->>'id' = p_token_id THEN
          CASE
            WHEN p_add THEN
              jsonb_set(
                t.value,
                '{activeEffects}',
                COALESCE(t.value->'activeEffects', '[]'::jsonb) || to_jsonb(p_effect_id),
                TRUE
              )
            ELSE
              jsonb_set(
                t.value,
                '{activeEffects}',
                (
                  SELECT COALESCE(jsonb_agg(to_jsonb(effect_id)), '[]'::jsonb)
                  FROM jsonb_array_elements_text(
                    COALESCE(t.value->'activeEffects', '[]'::jsonb)
                  ) AS effect_id
                  WHERE effect_id <> p_effect_id
                ),
                TRUE
              )
          END
        ELSE t.value
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(COALESCE(p_tokens, '[]'::jsonb)) AS t(value);
$$;

CREATE OR REPLACE FUNCTION public.record_combat_feature_effect_enter(
  p_campaign_id UUID,
  p_effect_id TEXT
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
  v_token JSONB;
  v_tokens JSONB;
  v_token_id TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to use combat actions.';
  END IF;

  IF p_effect_id IS DISTINCT FROM 'shell-defense' THEN
    RAISE EXCEPTION 'Unsupported combat feature effect.';
  END IF;

  v_is_dm := public.is_campaign_dm(p_campaign_id);

  SELECT * INTO v_ctx
  FROM public.combat_assert_active_controller(p_campaign_id, v_user_id, v_is_dm);

  v_combat := v_ctx.v_combat;
  v_turn := v_ctx.v_turn;
  v_token_id := v_ctx.v_token_id;

  SELECT value
  INTO v_token
  FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
  WHERE t.value->>'id' = v_token_id;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Combatant not found.';
  END IF;

  IF public.combat_token_has_effect(v_token, p_effect_id) THEN
    RAISE EXCEPTION 'This effect is already active.';
  END IF;

  IF public.combat_is_battle_over(v_combat) THEN
    v_turn := public.combat_reset_turn_economy(v_turn);
  ELSE
    IF COALESCE(v_turn->>'actionUsed', 'false')::BOOLEAN THEN
      RAISE EXCEPTION 'Your action has already been used this turn.';
    END IF;
    v_turn := jsonb_set(v_turn, '{actionUsed}', 'true'::jsonb, TRUE);
  END IF;

  v_tokens := public.combat_set_token_effect(
    COALESCE(v_combat->'tokens', '[]'::jsonb),
    v_token_id,
    p_effect_id,
    TRUE
  );

  v_combat := jsonb_set(v_combat, '{tokens}', v_tokens, TRUE);
  v_combat := jsonb_set(v_combat, '{turn}', v_turn, TRUE);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_combat_feature_effect_exit(
  p_campaign_id UUID,
  p_effect_id TEXT
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
  v_token JSONB;
  v_tokens JSONB;
  v_token_id TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to use combat actions.';
  END IF;

  IF p_effect_id IS DISTINCT FROM 'shell-defense' THEN
    RAISE EXCEPTION 'Unsupported combat feature effect.';
  END IF;

  v_is_dm := public.is_campaign_dm(p_campaign_id);

  SELECT * INTO v_ctx
  FROM public.combat_assert_active_controller(p_campaign_id, v_user_id, v_is_dm);

  v_combat := v_ctx.v_combat;
  v_turn := v_ctx.v_turn;
  v_token_id := v_ctx.v_token_id;

  SELECT value
  INTO v_token
  FROM jsonb_array_elements(COALESCE(v_combat->'tokens', '[]'::jsonb)) AS t(value)
  WHERE t.value->>'id' = v_token_id;

  IF v_token IS NULL THEN
    RAISE EXCEPTION 'Combatant not found.';
  END IF;

  IF NOT public.combat_token_has_effect(v_token, p_effect_id) THEN
    RAISE EXCEPTION 'This effect is not active.';
  END IF;

  IF public.combat_is_battle_over(v_combat) THEN
    v_turn := public.combat_reset_turn_economy(v_turn);
  ELSE
    IF COALESCE(v_turn->>'bonusActionUsed', 'false')::BOOLEAN THEN
      RAISE EXCEPTION 'Your bonus action has already been used this turn.';
    END IF;
    v_turn := jsonb_set(v_turn, '{bonusActionUsed}', 'true'::jsonb, TRUE);
  END IF;

  v_tokens := public.combat_set_token_effect(
    COALESCE(v_combat->'tokens', '[]'::jsonb),
    v_token_id,
    p_effect_id,
    FALSE
  );

  v_combat := jsonb_set(v_combat, '{tokens}', v_tokens, TRUE);
  v_combat := jsonb_set(v_combat, '{turn}', v_turn, TRUE);

  UPDATE public.campaigns
  SET combat_state = v_combat
  WHERE id = p_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_combat_feature_effect_enter(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_combat_feature_effect_exit(UUID, TEXT) TO authenticated;
