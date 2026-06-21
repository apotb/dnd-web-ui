"use client";

import { createClient } from "@/lib/supabase/client";
import {
  applyActionUsed,
  applyDashActionUsed,
  applyDisengageUsed,
  applyMainHandAttackUsed,
} from "@/lib/combat/turn";
import { persistCombatState } from "@/lib/hooks/use-realtime-combat-state";
import type { CombatState } from "@/lib/schemas/combat-state";

export async function recordMainHandAttackUsed(
  campaignId: string,
  state: CombatState,
  options: { isDm: boolean }
): Promise<{ next: CombatState; error?: string }> {
  const next = applyMainHandAttackUsed(state);

  if (next.turn.actionUsedForTwoWeapon === state.turn.actionUsedForTwoWeapon) {
    return { next: state };
  }

  if (options.isDm) {
    const error = await persistCombatState(campaignId, next);
    return { next, error: error ?? undefined };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("record_combat_main_hand_attack", {
    p_campaign_id: campaignId,
  });

  return { next, error: error?.message };
}

export async function recordCombatDisengage(
  campaignId: string,
  state: CombatState,
  options: { isDm: boolean }
): Promise<{ next: CombatState; error?: string }> {
  const next = applyDisengageUsed(state);

  if (
    next.turn.disengageUsed === state.turn.disengageUsed &&
    next.turn.actionUsed === state.turn.actionUsed
  ) {
    return { next: state };
  }

  if (options.isDm) {
    const error = await persistCombatState(campaignId, next);
    return { next, error: error ?? undefined };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("record_combat_disengage", {
    p_campaign_id: campaignId,
  });

  return { next, error: error?.message };
}

export async function recordCombatDash(
  campaignId: string,
  state: CombatState,
  options: { isDm: boolean }
): Promise<{ next: CombatState; error?: string }> {
  const next = applyDashActionUsed(state);

  if (
    next.turn.dashUsed === state.turn.dashUsed &&
    next.turn.actionUsed === state.turn.actionUsed
  ) {
    return { next: state };
  }

  if (options.isDm) {
    const error = await persistCombatState(campaignId, next);
    return { next, error: error ?? undefined };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("record_combat_dash", {
    p_campaign_id: campaignId,
  });

  return { next, error: error?.message };
}

export async function recordCombatActionUsed(
  campaignId: string,
  state: CombatState,
  options: { isDm: boolean }
): Promise<{ next: CombatState; error?: string }> {
  const next = applyActionUsed(state);

  if (next.turn.actionUsed === state.turn.actionUsed) {
    return { next: state };
  }

  if (options.isDm) {
    const error = await persistCombatState(campaignId, next);
    return { next, error: error ?? undefined };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("record_combat_action_used", {
    p_campaign_id: campaignId,
  });

  return { next, error: error?.message };
}
