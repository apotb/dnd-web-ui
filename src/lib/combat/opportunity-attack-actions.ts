"use client";

import { submitCombatOpportunityAttack } from "@/lib/combat/attack-actions";
import {
  canSkipOpportunityAttackAction,
  hasSubmittedOpportunityAttack,
  skipOpportunityAttackForAttacker,
} from "@/lib/combat/opportunity-attacks";
import type { CombatState } from "@/lib/schemas/combat-state";
import { persistCombatState } from "@/lib/hooks/use-realtime-combat-state";
import { createClient } from "@/lib/supabase/client";

export { submitCombatOpportunityAttack };

export async function skipCombatOpportunityAttack(
  campaignId: string,
  state: CombatState,
  options: {
    isDm: boolean;
    attackerTokenId: string;
  }
): Promise<{ next: CombatState; error?: string }> {
  if (hasSubmittedOpportunityAttack(state, options.attackerTokenId)) {
    return { next: state, error: "Your opportunity attack is already pending." };
  }

  if (!canSkipOpportunityAttackAction(state, options.attackerTokenId)) {
    return { next: state, error: "No opportunity attack to skip." };
  }

  const next = skipOpportunityAttackForAttacker(state, options.attackerTokenId);

  if (next.pendingOpportunityAttacks === state.pendingOpportunityAttacks) {
    return { next: state, error: "No opportunity attack to skip." };
  }

  if (options.isDm) {
    const error = await persistCombatState(campaignId, next);
    return { next, error: error ?? undefined };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("skip_combat_opportunity_attack", {
    p_campaign_id: campaignId,
    p_attacker_token_id: options.attackerTokenId,
  });

  return { next, error: error?.message };
}
