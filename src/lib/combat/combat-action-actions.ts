"use client";

import { createClient } from "@/lib/supabase/client";
import { saveCharacterData } from "@/lib/character/save-character-data";
import { applyObjectPickup } from "@/lib/combat/object-pickup";
import { applyAmmoRefill } from "@/lib/combat/ammo-refill";
import { applyEquipmentChange } from "@/lib/combat/object-equipment-change";
import {
  applyActionUsed,
  applyBonusActionUsed,
  applyDashActionUsed,
  applyDisengageUsed,
  applyMainHandAttackUsed,
} from "@/lib/combat/turn";
import { persistCombatState } from "@/lib/hooks/use-realtime-combat-state";
import type { ParsedCharacter } from "@/lib/character/utils";
import type { CombatState } from "@/lib/schemas/combat-state";
import type { Item } from "@/lib/schemas/item";

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

export async function recordCombatBonusActionUsed(
  campaignId: string,
  state: CombatState,
  options: { isDm: boolean }
): Promise<{ next: CombatState; error?: string }> {
  const next = applyBonusActionUsed(state);

  if (next.turn.bonusActionUsed === state.turn.bonusActionUsed) {
    return { next: state };
  }

  if (options.isDm) {
    const error = await persistCombatState(campaignId, next);
    return { next, error: error ?? undefined };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("record_combat_bonus_action_used", {
    p_campaign_id: campaignId,
  });

  return { next, error: error?.message };
}

export async function recordCombatLayOnHands(
  campaignId: string,
  state: CombatState,
  options: {
    isDm: boolean;
    targetTokenId?: string;
    targetCurrentHp?: number;
  }
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
  const { error } = await supabase.rpc("record_combat_lay_on_hands", {
    p_campaign_id: campaignId,
    p_target_token_id: options.targetTokenId ?? null,
    p_target_current_hp: options.targetCurrentHp ?? null,
  });

  return { next, error: error?.message };
}

export async function recordCombatObjectPickup(
  campaignId: string,
  state: CombatState,
  options: {
    isDm: boolean;
    actorTokenId: string;
    markerId: string;
    character: ParsedCharacter;
    catalogItems: Record<string, Item>;
  }
): Promise<{
  next: CombatState;
  error?: string;
  characterId?: string;
  inventoryItems?: ParsedCharacter["data"]["inventory"]["items"];
}> {
  const result = applyObjectPickup(
    state,
    options.actorTokenId,
    options.markerId,
    options.character,
    options.catalogItems
  );
  if (!result.ok) {
    return { next: state, error: result.error };
  }

  const { next, inventoryItems, characterId } = result;

  if (options.isDm) {
    const error = await persistCombatState(campaignId, next);
    if (error) {
      return { next: state, error };
    }
  } else {
    const supabase = createClient();
    const { error } = await supabase.rpc("pickup_combat_object", {
      p_campaign_id: campaignId,
      p_marker_id: options.markerId,
      p_actor_token_id: options.actorTokenId,
    });
    if (error) {
      return { next: state, error: error.message };
    }
  }

  const { error: saveError } = await saveCharacterData(
    characterId,
    {
      ...options.character.data,
      inventory: {
        ...options.character.data.inventory,
        items: inventoryItems,
      },
    },
    undefined,
    { isDm: options.isDm, originalData: options.character.data }
  );
  if (saveError) {
    return { next: state, error: saveError };
  }

  return { next, characterId, inventoryItems };
}

export async function recordCombatEquipmentChange(
  campaignId: string,
  state: CombatState,
  options: {
    isDm: boolean;
    actorTokenId: string;
    character: ParsedCharacter;
    nextItems: ParsedCharacter["data"]["inventory"]["items"];
    catalogItems: Record<string, Item>;
  }
): Promise<{
  next: CombatState;
  error?: string;
  characterId?: string;
  inventoryItems?: ParsedCharacter["data"]["inventory"]["items"];
}> {
  const result = applyEquipmentChange(
    state,
    options.actorTokenId,
    options.character,
    options.nextItems,
    options.catalogItems
  );
  if (!result.ok) {
    return { next: state, error: result.error };
  }

  const { next, inventoryItems, characterId, interactionCount } = result;

  if (options.isDm) {
    const error = await persistCombatState(campaignId, next);
    if (error) {
      return { next: state, error };
    }
  } else {
    const supabase = createClient();
    const { error } = await supabase.rpc("record_combat_object_interactions", {
      p_campaign_id: campaignId,
      p_count: interactionCount,
    });
    if (error) {
      return { next: state, error: error.message };
    }
  }

  const { error: saveError } = await saveCharacterData(
    characterId,
    {
      ...options.character.data,
      inventory: {
        ...options.character.data.inventory,
        items: inventoryItems,
      },
    },
    undefined,
    { isDm: options.isDm, originalData: options.character.data }
  );
  if (saveError) {
    return { next: state, error: saveError };
  }

  return { next, characterId, inventoryItems };
}

export async function recordCombatAmmoRefill(
  campaignId: string,
  state: CombatState,
  options: {
    isDm: boolean;
    actorTokenId: string;
    character: ParsedCharacter;
    catalogItems: Record<string, Item>;
  }
): Promise<{
  next: CombatState;
  error?: string;
  characterId?: string;
  inventoryItems?: ParsedCharacter["data"]["inventory"]["items"];
}> {
  const result = applyAmmoRefill(
    state,
    options.actorTokenId,
    options.character,
    options.catalogItems
  );
  if (!result.ok) {
    return { next: state, error: result.error };
  }

  const { next, inventoryItems, characterId } = result;

  if (options.isDm) {
    const error = await persistCombatState(campaignId, next);
    if (error) {
      return { next: state, error };
    }
  } else {
    const supabase = createClient();
    const { error } = await supabase.rpc("record_combat_object_interactions", {
      p_campaign_id: campaignId,
      p_count: 1,
    });
    if (error) {
      return { next: state, error: error.message };
    }
  }

  const { error: saveError } = await saveCharacterData(
    characterId,
    {
      ...options.character.data,
      inventory: {
        ...options.character.data.inventory,
        items: inventoryItems,
      },
    },
    undefined,
    { isDm: options.isDm, originalData: options.character.data }
  );
  if (saveError) {
    return { next: state, error: saveError };
  }

  return { next, characterId, inventoryItems };
}
