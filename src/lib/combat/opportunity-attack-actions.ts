"use client";

import {
  createPendingAttack,
  type AttackSubmissionInput,
} from "@/lib/combat/pending-attack-builder";
import type { CombatOption } from "@/lib/combat/combat-options";
import { skipOpportunityAttackForAttacker } from "@/lib/combat/opportunity-attacks";
import type { ParsedCharacter } from "@/lib/character/utils";
import type { DerivedAttack } from "@/lib/dnd/attacks";
import type { EnemyData } from "@/lib/schemas/enemy";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import { persistCombatState } from "@/lib/hooks/use-realtime-combat-state";
import { createClient } from "@/lib/supabase/client";

export async function submitCombatOpportunityAttack(
  campaignId: string,
  state: CombatState,
  options: {
    isDm: boolean;
    attacker: CombatToken;
    combatOption: CombatOption;
    attack: DerivedAttack;
    targets: CombatToken[];
    submission: AttackSubmissionInput;
    charactersById: Record<string, ParsedCharacter>;
    enemiesBySlug: Record<string, { data: EnemyData }>;
  }
): Promise<{ next: CombatState; error?: string }> {
  if (state.pendingAttack) {
    return { next: state, error: "An attack is already pending." };
  }

  const pending = createPendingAttack(
    state,
    options.attacker,
    options.combatOption,
    options.attack,
    options.targets,
    null,
    options.submission,
    options.charactersById,
    options.enemiesBySlug,
    { isOpportunityAttack: true }
  );

  const next: CombatState = { ...state, pendingAttack: pending };

  if (options.isDm) {
    const error = await persistCombatState(campaignId, next);
    return { next, error: error ?? undefined };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("submit_combat_opportunity_attack", {
    p_campaign_id: campaignId,
    p_attacker_token_id: options.attacker.id,
    p_pending_attack: pending,
  });

  return { next, error: error?.message };
}

export async function skipCombatOpportunityAttack(
  campaignId: string,
  state: CombatState,
  options: {
    isDm: boolean;
    attackerTokenId: string;
  }
): Promise<{ next: CombatState; error?: string }> {
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
