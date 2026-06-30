"use client";

import { hasSubmittedOpportunityAttack } from "@/lib/combat/opportunity-attacks";
import { applyResolvedAttack, canSubmitOpportunityAttack, type CharacterHpUpdate } from "@/lib/combat/attack-resolution";
import {
  applyDmSaveRolls,
  applySaveRoll,
  createPendingAttack,
  type AttackSubmissionInput,
} from "@/lib/combat/pending-attack-builder";
import type { CombatOption } from "@/lib/combat/combat-options";
import {
  addPendingAttack,
  getPendingAttackById,
  hasPendingAttackForAttacker,
  removePendingAttack,
  updatePendingAttack,
} from "@/lib/combat/pending-attacks";
import { saveCharacterData } from "@/lib/character/save-character-data";
import type { ParsedCharacter } from "@/lib/character/utils";
import type { DerivedAttack } from "@/lib/dnd/attacks";
import type { EnemyData } from "@/lib/schemas/enemy";
import type { CombatState, CombatToken, PendingAttack } from "@/lib/schemas/combat-state";
import { persistCombatState } from "@/lib/hooks/use-realtime-combat-state";
import { canUserActForToken } from "@/lib/combat/turn";
import { createClient } from "@/lib/supabase/client";

export type { CharacterHpUpdate } from "@/lib/combat/attack-resolution";

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

function getAttackerCharacter(
  attacker: CombatToken,
  charactersById: Record<string, ParsedCharacter>
): ParsedCharacter | null {
  return attacker.characterId ? charactersById[attacker.characterId] ?? null : null;
}

export function shouldSkipDmReviewForAttacker(
  userId: string | null,
  isDm: boolean,
  attacker: CombatToken,
  charactersById: Record<string, ParsedCharacter>
): boolean {
  if (!isDm) return false;
  return canUserActForToken(userId, isDm, attacker, getAttackerCharacter(attacker, charactersById));
}

async function persistCharacterHpUpdates(
  characterUpdates: CharacterHpUpdate[],
  charactersById: Record<string, ParsedCharacter>
): Promise<void> {
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
        ...(update.inventoryItems != null
          ? {
              inventory: {
                ...character.data.inventory,
                items: update.inventoryItems,
              },
            }
          : {}),
      },
      undefined,
      { isDm: true, originalData: character.data }
    );
  }
}

async function finalizePendingAttack(
  campaignId: string,
  state: CombatState,
  pending: PendingAttack,
  charactersById: Record<string, ParsedCharacter>
): Promise<{ next: CombatState; characterUpdates: CharacterHpUpdate[]; error?: string }> {
  const stateWithPending = getPendingAttackById(state, pending.id)
    ? state
    : addPendingAttack(state, pending);
  const { next, characterUpdates } = applyResolvedAttack(stateWithPending, pending, charactersById);
  const error = await persistCombatState(campaignId, next);
  if (error) {
    return { next: state, characterUpdates: [], error };
  }
  await persistCharacterHpUpdates(characterUpdates, charactersById);
  return { next, characterUpdates, error: undefined };
}

async function maybeFinalizeAfterSaves(
  campaignId: string,
  state: CombatState,
  pending: PendingAttack,
  charactersById: Record<string, ParsedCharacter>
): Promise<{ next: CombatState; characterUpdates: CharacterHpUpdate[]; error?: string } | null> {
  if (!pending.skipDmReview || pending.status !== "awaiting-dm-review") {
    return null;
  }
  const stateWithPending = updatePendingAttack(state, pending.id, pending);
  return finalizePendingAttack(campaignId, stateWithPending, pending, charactersById);
}

export async function submitCombatAttack(
  campaignId: string,
  state: CombatState,
  options: {
    userId: string | null;
    isDm: boolean;
    attacker: CombatToken;
    combatOption: CombatOption;
    attack: DerivedAttack;
    targets: CombatToken[];
    aoeCenter: { x: number; y: number } | null;
    submission: AttackSubmissionInput;
    charactersById: Record<string, ParsedCharacter>;
    enemiesBySlug: Record<string, { data: EnemyData }>;
    catalogItems?: Record<string, import("@/lib/schemas/item").Item>;
    classCatalog?: import("@/lib/dnd/phb/types").PhbClass[];
  }
): Promise<{ next: CombatState; characterUpdates?: CharacterHpUpdate[]; error?: string }> {
  if (hasPendingAttackForAttacker(state, options.attacker.id)) {
    return { next: state, error: "You already have an action pending." };
  }

  const skipDmReview = shouldSkipDmReviewForAttacker(
    options.userId,
    options.isDm,
    options.attacker,
    options.charactersById
  );

  const pending = createPendingAttack(
    state,
    options.attacker,
    options.combatOption,
    options.attack,
    options.targets,
    options.aoeCenter,
    options.submission,
    options.charactersById,
    options.enemiesBySlug,
    { skipDmReview, catalogItems: options.catalogItems, classCatalog: options.classCatalog }
  );

  if (skipDmReview && pending.status === "awaiting-dm-review") {
    return finalizePendingAttack(campaignId, state, pending, options.charactersById);
  }

  const next = addPendingAttack(state, pending);

  const { error } = await persistOrRpc(campaignId, next, options.isDm, "submit_combat_attack", {
    p_campaign_id: campaignId,
    p_pending_attack: pending,
  });

  return { next, error };
}

export async function submitCombatOpportunityAttack(
  campaignId: string,
  state: CombatState,
  options: {
    userId: string | null;
    isDm: boolean;
    attacker: CombatToken;
    combatOption: CombatOption;
    attack: DerivedAttack;
    targets: CombatToken[];
    submission: AttackSubmissionInput;
    charactersById: Record<string, ParsedCharacter>;
    enemiesBySlug: Record<string, { data: EnemyData }>;
    catalogItems?: Record<string, import("@/lib/schemas/item").Item>;
    classCatalog?: import("@/lib/dnd/phb/types").PhbClass[];
  }
): Promise<{ next: CombatState; characterUpdates?: CharacterHpUpdate[]; error?: string }> {
  if (!canSubmitOpportunityAttack(state, options.attacker.id)) {
    if (hasSubmittedOpportunityAttack(state, options.attacker.id)) {
      return { next: state, error: "Your opportunity attack is already pending." };
    }
    return { next: state, error: "You already have an action pending." };
  }

  const skipDmReview = shouldSkipDmReviewForAttacker(
    options.userId,
    options.isDm,
    options.attacker,
    options.charactersById
  );

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
    { isOpportunityAttack: true, skipDmReview }
  );

  if (skipDmReview && pending.status === "awaiting-dm-review") {
    return finalizePendingAttack(campaignId, state, pending, options.charactersById);
  }

  const next = addPendingAttack(state, pending);

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

export async function submitCombatSaveRoll(
  campaignId: string,
  state: CombatState,
  options: {
    isDm: boolean;
    pendingAttackId: string;
    tokenId: string;
    saveRoll: number;
    saveTotal: number;
    charactersById: Record<string, ParsedCharacter>;
  }
): Promise<{ next: CombatState; characterUpdates?: CharacterHpUpdate[]; error?: string }> {
  const pending = getPendingAttackById(state, options.pendingAttackId);
  if (!pending) {
    return { next: state, error: "No pending attack." };
  }

  const updated = applySaveRoll(
    pending,
    options.tokenId,
    options.saveRoll,
    options.saveTotal
  );
  const next = updatePendingAttack(state, options.pendingAttackId, updated);

  const finalized = await maybeFinalizeAfterSaves(
    campaignId,
    next,
    updated,
    options.charactersById
  );
  if (finalized) {
    return finalized;
  }

  const { error } = await persistOrRpc(campaignId, next, options.isDm, "submit_combat_save_roll", {
    p_campaign_id: campaignId,
    p_pending_attack_id: options.pendingAttackId,
    p_token_id: options.tokenId,
    p_save_roll: options.saveRoll,
    p_save_total: options.saveTotal,
  });

  return { next, error };
}

export async function submitCombatDmSaveRolls(
  campaignId: string,
  state: CombatState,
  pendingAttackId: string,
  saves: Array<{ tokenId: string; saveRoll: number; saveTotal: number }>,
  charactersById: Record<string, ParsedCharacter>,
  isDm: boolean
): Promise<{ next: CombatState; characterUpdates?: CharacterHpUpdate[]; error?: string }> {
  const pending = getPendingAttackById(state, pendingAttackId);
  if (!pending || !isDm) {
    return { next: state, error: "No pending attack." };
  }

  const updated = applyDmSaveRolls(pending, saves);
  const next = updatePendingAttack(state, pendingAttackId, updated);

  const finalized = await maybeFinalizeAfterSaves(
    campaignId,
    next,
    updated,
    charactersById
  );
  if (finalized) {
    return finalized;
  }

  const error = await persistCombatState(campaignId, next);
  return { next, error: error ?? undefined };
}

export async function resolveCombatAttack(
  campaignId: string,
  state: CombatState,
  pending: PendingAttack,
  charactersById: Record<string, ParsedCharacter>,
  isDm: boolean
): Promise<{ next: CombatState; characterUpdates?: CharacterHpUpdate[]; error?: string }> {
  if (!isDm) {
    return { next: state, error: "Only the DM can resolve attacks." };
  }

  const result = await finalizePendingAttack(campaignId, state, pending, charactersById);
  return {
    next: result.next,
    characterUpdates: result.characterUpdates,
    error: result.error,
  };
}

export async function cancelCombatAttack(
  campaignId: string,
  state: CombatState,
  pendingAttackId: string,
  isDm: boolean
): Promise<{ next: CombatState; error?: string }> {
  if (!getPendingAttackById(state, pendingAttackId)) {
    return { next: state, error: "No pending attack." };
  }

  const next = removePendingAttack(state, pendingAttackId);
  const { error } = await persistOrRpc(campaignId, next, isDm, "cancel_combat_attack", {
    p_campaign_id: campaignId,
    p_pending_attack_id: pendingAttackId,
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
  const next = updatePendingAttack(state, pending.id, pending);
  const error = await persistCombatState(campaignId, next);
  return { next, error: error ?? undefined };
}
