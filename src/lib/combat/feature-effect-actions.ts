"use client";

import { createClient } from "@/lib/supabase/client";
import {
  applyCombatEffectEnter,
  applyCombatEffectExit,
  getCombatFeatureEffectDef,
} from "@/lib/combat/feature-effects";
import {
  applyConditionSlugs,
  removeConditionSlugs,
} from "@/lib/dnd/conditions";
import { saveCharacterData } from "@/lib/character/save-character-data";
import type { ParsedCharacter } from "@/lib/character/utils";
import { persistCombatState } from "@/lib/hooks/use-realtime-combat-state";
import type { CombatState } from "@/lib/schemas/combat-state";

function sameConditionSets(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((slug) => setA.has(slug));
}

async function syncCharacterConditionsForEffect(
  state: CombatState,
  options: {
    isDm: boolean;
    tokenId: string;
    effectId: string;
    mode: "enter" | "exit";
    character?: ParsedCharacter | null;
  }
): Promise<{ error?: string }> {
  const def = getCombatFeatureEffectDef(options.effectId);
  const slugs = def?.appliedConditionSlugs;
  if (!slugs?.length || !options.character) return {};

  const token = state.tokens.find((entry) => entry.id === options.tokenId);
  if (
    !token ||
    token.kind !== "party" ||
    !token.characterId ||
    token.characterId !== options.character.id
  ) {
    return {};
  }

  const current = options.character.data.combat.conditions;
  // v1: exiting an effect removes its slugs even if the player added them manually while active.
  const next =
    options.mode === "enter"
      ? applyConditionSlugs(current, slugs)
      : removeConditionSlugs(current, slugs);

  if (sameConditionSets(current, next)) return {};

  return saveCharacterData(
    options.character.id,
    {
      ...options.character.data,
      combat: {
        ...options.character.data.combat,
        conditions: next,
      },
    },
    undefined,
    { isDm: options.isDm, originalData: options.character.data }
  );
}

export async function recordCombatFeatureEffectEnter(
  campaignId: string,
  state: CombatState,
  options: {
    isDm: boolean;
    tokenId: string;
    effectId: string;
    character?: ParsedCharacter | null;
  }
): Promise<{ next: CombatState; error?: string }> {
  const next = applyCombatEffectEnter(state, options.tokenId, options.effectId);

  if (
    next.turn.actionUsed === state.turn.actionUsed &&
    next.tokens === state.tokens
  ) {
    return { next: state };
  }

  if (options.isDm) {
    const error = await persistCombatState(campaignId, next);
    if (error) return { next: state, error };
  } else {
    const supabase = createClient();
    const { error } = await supabase.rpc("record_combat_feature_effect_enter", {
      p_campaign_id: campaignId,
      p_effect_id: options.effectId,
    });
    if (error) return { next: state, error: error.message };
  }

  const { error: saveError } = await syncCharacterConditionsForEffect(next, {
    ...options,
    mode: "enter",
  });
  return { next, error: saveError };
}

export async function recordCombatFeatureEffectExit(
  campaignId: string,
  state: CombatState,
  options: {
    isDm: boolean;
    tokenId: string;
    effectId: string;
    character?: ParsedCharacter | null;
  }
): Promise<{ next: CombatState; error?: string }> {
  const next = applyCombatEffectExit(state, options.tokenId, options.effectId);

  if (
    next.turn.bonusActionUsed === state.turn.bonusActionUsed &&
    next.tokens === state.tokens
  ) {
    return { next: state };
  }

  if (options.isDm) {
    const error = await persistCombatState(campaignId, next);
    if (error) return { next: state, error };
  } else {
    const supabase = createClient();
    const { error } = await supabase.rpc("record_combat_feature_effect_exit", {
      p_campaign_id: campaignId,
      p_effect_id: options.effectId,
    });
    if (error) return { next: state, error: error.message };
  }

  const { error: saveError } = await syncCharacterConditionsForEffect(next, {
    ...options,
    mode: "exit",
  });
  return { next, error: saveError };
}
