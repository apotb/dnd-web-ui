"use client";

import { createClient } from "@/lib/supabase/client";
import { applyCombatMoveWithOpportunityAttacks } from "@/lib/combat/opportunity-attacks";
import { applyCombatMove } from "@/lib/combat/movement";
import { persistCombatState } from "@/lib/hooks/use-realtime-combat-state";
import type { CombatState } from "@/lib/schemas/combat-state";

export async function commitCombatMove(
  campaignId: string,
  state: CombatState,
  options: {
    isDm: boolean;
    tokenId: string;
    x: number;
    y: number;
    costFeet: number;
    dashConsumed: boolean;
    opportunityAttackerTokenIds?: string[];
  }
): Promise<{ next: CombatState; error?: string }> {
  const next =
    options.opportunityAttackerTokenIds && options.opportunityAttackerTokenIds.length > 0
      ? applyCombatMoveWithOpportunityAttacks(
          state,
          options.tokenId,
          { x: options.x, y: options.y },
          options.costFeet,
          options.dashConsumed,
          options.opportunityAttackerTokenIds
        )
      : applyCombatMove(
          state,
          options.tokenId,
          { x: options.x, y: options.y },
          options.costFeet,
          options.dashConsumed
        );

  if (options.isDm) {
    const error = await persistCombatState(campaignId, next);
    return { next, error: error ?? undefined };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("apply_combat_move", {
    p_campaign_id: campaignId,
    p_token_id: options.tokenId,
    p_x: options.x,
    p_y: options.y,
    p_cost_feet: options.costFeet,
    p_dash_consumed: options.dashConsumed,
  });

  return { next, error: error?.message };
}
