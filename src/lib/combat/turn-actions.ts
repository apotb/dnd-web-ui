"use client";

import { createClient } from "@/lib/supabase/client";
import { advanceTurn, canAdvanceTurnWithDeathSave } from "@/lib/combat/turn";
import {
  canAdvanceTurnWithOpportunityAttacks,
} from "@/lib/combat/opportunity-attacks";
import { canAdvanceTurnWithPendingAttacks } from "@/lib/combat/pending-attacks";
import { persistCombatState } from "@/lib/hooks/use-realtime-combat-state";
import type { CharacterData } from "@/lib/schemas/character";
import type { CombatState } from "@/lib/schemas/combat-state";

export async function endCombatTurn(
  campaignId: string,
  state: CombatState,
  options: { isDm: boolean; currentTurnCombat?: CharacterData["combat"] }
): Promise<{ next: CombatState; error?: string }> {
  if (!canAdvanceTurnWithOpportunityAttacks(state)) {
    return {
      next: state,
      error: "Opportunity attacks must be resolved before ending this turn.",
    };
  }

  if (!canAdvanceTurnWithPendingAttacks(state)) {
    return {
      next: state,
      error: "Resolve pending actions before ending this turn.",
    };
  }

  if (!canAdvanceTurnWithDeathSave(state, options.currentTurnCombat)) {
    return {
      next: state,
      error: "Make your death saving throw before ending this turn.",
    };
  }

  const next = advanceTurn(state);

  if (options.isDm) {
    const error = await persistCombatState(campaignId, next);
    return { next, error: error ?? undefined };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("advance_combat_turn", {
    p_campaign_id: campaignId,
  });

  return { next, error: error?.message };
}
