"use client";

import { applyResolvedAttack } from "@/lib/combat/attack-resolution";
import {
  applyDmSaveRolls,
  applySaveRoll,
  createPendingAttack,
  type AttackSubmissionInput,
} from "@/lib/combat/pending-attack-builder";
import type { CombatOption } from "@/lib/combat/combat-options";
import { saveCharacterData } from "@/lib/character/save-character-data";
import type { ParsedCharacter } from "@/lib/character/utils";
import type { DerivedAttack } from "@/lib/dnd/attacks";
import type { EnemyData } from "@/lib/schemas/enemy";
import type { CombatState, CombatToken, PendingAttack } from "@/lib/schemas/combat-state";
import { persistCombatState } from "@/lib/hooks/use-realtime-combat-state";
import { createClient } from "@/lib/supabase/client";

async function persistOrRpc(
  campaignId: string,
  next: CombatState,
  isDm: boolean,
  rpcName?: string,
  rpcParams?: Record<string, unknown>
): Promise<{ error?: string }> {
  if (isDm) {
    const error = await persistCombatState(campaignId, next);
    return { error: error ?? undefined };
  }
  if (!rpcName) {
    return { error: "RPC required for player action." };
  }
  const supabase = createClient();
  const { error } = await supabase.rpc(rpcName, rpcParams ?? { p_campaign_id: campaignId });
  return { error: error?.message };
}

export async function submitCombatAttack(
  campaignId: string,
  state: CombatState,
  options: {
    isDm: boolean;
    attacker: CombatToken;
    combatOption: CombatOption;
    attack: DerivedAttack;
    targets: CombatToken[];
    aoeCenter: { x: number; y: number } | null;
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
    options.aoeCenter,
    options.submission,
    options.charactersById,
    options.enemiesBySlug
  );

  const next: CombatState = { ...state, pendingAttack: pending };

  const { error } = await persistOrRpc(campaignId, next, options.isDm, "submit_combat_attack", {
    p_campaign_id: campaignId,
    p_pending_attack: pending,
  });

  return { next, error };
}

export async function submitCombatSaveRoll(
  campaignId: string,
  state: CombatState,
  options: {
    isDm: boolean;
    tokenId: string;
    saveRoll: number;
    saveTotal: number;
  }
): Promise<{ next: CombatState; error?: string }> {
  if (!state.pendingAttack) {
    return { next: state, error: "No pending attack." };
  }

  const pending = applySaveRoll(
    state.pendingAttack,
    options.tokenId,
    options.saveRoll,
    options.saveTotal
  );
  const next: CombatState = { ...state, pendingAttack: pending };

  const { error } = await persistOrRpc(campaignId, next, options.isDm, "submit_combat_save_roll", {
    p_campaign_id: campaignId,
    p_token_id: options.tokenId,
    p_save_roll: options.saveRoll,
    p_save_total: options.saveTotal,
  });

  return { next, error };
}

export async function submitCombatDmSaveRolls(
  campaignId: string,
  state: CombatState,
  saves: Array<{ tokenId: string; saveRoll: number; saveTotal: number }>,
  isDm: boolean
): Promise<{ next: CombatState; error?: string }> {
  if (!state.pendingAttack || !isDm) {
    return { next: state, error: "No pending attack." };
  }

  const pending = applyDmSaveRolls(state.pendingAttack, saves);
  const next: CombatState = { ...state, pendingAttack: pending };
  const error = await persistCombatState(campaignId, next);
  return { next, error: error ?? undefined };
}

export async function resolveCombatAttack(
  campaignId: string,
  state: CombatState,
  pending: PendingAttack,
  charactersById: Record<string, ParsedCharacter>,
  isDm: boolean
): Promise<{ next: CombatState; error?: string }> {
  if (!isDm) {
    return { next: state, error: "Only the DM can resolve attacks." };
  }

  const { next, characterUpdates } = applyResolvedAttack(state, pending, charactersById);

  const error = await persistCombatState(campaignId, next);
  if (error) {
    return { next: state, error };
  }

  for (const update of characterUpdates) {
    const character = charactersById[update.characterId];
    if (!character) continue;
    await saveCharacterData(
      update.characterId,
      {
        ...character.data,
        combat: {
          ...character.data.combat,
          currentHp: update.currentHp,
          tempHp: update.tempHp,
        },
      },
      undefined,
      { isDm: true, originalData: character.data }
    );
  }

  return { next, error: undefined };
}

export async function cancelCombatAttack(
  campaignId: string,
  state: CombatState,
  isDm: boolean
): Promise<{ next: CombatState; error?: string }> {
  const next: CombatState = { ...state, pendingAttack: null };
  const { error } = await persistOrRpc(campaignId, next, isDm, "cancel_combat_attack", {
    p_campaign_id: campaignId,
  });
  return { next, error };
}

export async function updatePendingAttackForDmReview(
  campaignId: string,
  state: CombatState,
  pending: PendingAttack,
  isDm: boolean
): Promise<{ next: CombatState; error?: string }> {
  if (!isDm) {
    return { next: state, error: "Only the DM can update pending attacks." };
  }
  const next: CombatState = { ...state, pendingAttack: pending };
  const error = await persistCombatState(campaignId, next);
  return { next, error: error ?? undefined };
}
