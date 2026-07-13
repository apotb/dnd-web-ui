"use client";

import { createClient } from "@/lib/supabase/client";
import { saveCharacterData } from "@/lib/character/save-character-data";
import { applyObjectPickup } from "@/lib/combat/object-pickup";
import { applyAmmoRefill } from "@/lib/combat/ammo-refill";
import { applyEquipmentChange } from "@/lib/combat/object-equipment-change";
import {
  applyCombatGetUp,
  removeProneFromCharacterData,
  removeProneFromPartyData,
} from "@/lib/combat/prone-actions";
import { applyHelpGrant } from "@/lib/combat/help";
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
import type { PartyAlly, PartyData } from "@/lib/schemas/party";

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

function sameConditionSets(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((slug) => setA.has(slug));
}

async function persistPartyData(
  campaignId: string,
  partyData: PartyData
): Promise<string | undefined> {
  const supabase = createClient();
  const { error } = await supabase
    .from("campaigns")
    .update({ party_data: partyData })
    .eq("id", campaignId);
  return error?.message;
}

export async function recordCombatGetUp(
  campaignId: string,
  state: CombatState,
  options: {
    isDm: boolean;
    tokenId: string;
    costFeet: number;
    speedFt: number;
    dashUsed: boolean;
    character?: ParsedCharacter | null;
    ally?: PartyAlly | null;
    partyData?: PartyData;
  }
): Promise<{ next: CombatState; partyData?: PartyData; error?: string }> {
  const next = applyCombatGetUp(
    state,
    options.tokenId,
    options.costFeet,
    options.speedFt,
    options.dashUsed
  );

  if (next.turn.movementUsedFeet === state.turn.movementUsedFeet) {
    return { next: state };
  }

  if (options.isDm) {
    const error = await persistCombatState(campaignId, next);
    if (error) return { next: state, error };
  } else {
    const supabase = createClient();
    const { error } = await supabase.rpc("record_combat_get_up", {
      p_campaign_id: campaignId,
      p_cost_feet: options.costFeet,
    });
    if (error) return { next: state, error: error.message };
  }

  let nextPartyData = options.partyData;

  if (options.character) {
    const current = options.character.data.combat.conditions ?? [];
    const updated = removeProneFromCharacterData(options.character);
    if (!sameConditionSets(current, updated)) {
      const { error: saveError } = await saveCharacterData(
        options.character.id,
        {
          ...options.character.data,
          combat: {
            ...options.character.data.combat,
            conditions: updated,
          },
        },
        undefined,
        { isDm: options.isDm, originalData: options.character.data }
      );
      if (saveError) return { next: state, error: saveError };
    }
  } else if (options.ally && options.partyData) {
    nextPartyData = removeProneFromPartyData(options.partyData, options.ally.id);
    if (nextPartyData !== options.partyData) {
      const error = await persistPartyData(campaignId, nextPartyData);
      if (error) return { next: state, error };
    }
  }

  return { next, partyData: nextPartyData };
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

export async function recordCombatHelp(
  campaignId: string,
  state: CombatState,
  options: { isDm: boolean; beneficiaryTokenId: string }
): Promise<{ next: CombatState; error?: string }> {
  const helperTokenId = state.initiative.order[state.turn.index];
  if (!helperTokenId) {
    return { next: state, error: "No active combatant." };
  }

  const next = applyHelpGrant(state, helperTokenId, options.beneficiaryTokenId);

  if (
    next.turn.actionUsed === state.turn.actionUsed &&
    (next.helpGrants ?? []).length === (state.helpGrants ?? []).length
  ) {
    return { next: state, error: "Help cannot be used right now." };
  }

  if (options.isDm) {
    const error = await persistCombatState(campaignId, next);
    return { next, error: error ?? undefined };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("record_combat_help", {
    p_campaign_id: campaignId,
    p_beneficiary_token_id: options.beneficiaryTokenId,
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
