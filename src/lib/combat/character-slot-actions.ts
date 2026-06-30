"use client";

import type { ParsedCharacter } from "@/lib/character/utils";
import { assignCharacterToPlaceholder } from "@/lib/combat/character-placeholder";
import { createClient } from "@/lib/supabase/client";
import { persistCombatState } from "@/lib/hooks/use-realtime-combat-state";
import type { CombatState } from "@/lib/schemas/combat-state";

export async function claimCombatCharacterSlot(
  campaignId: string,
  state: CombatState,
  options: {
    isDm: boolean;
    tokenId: string;
    character: ParsedCharacter;
  }
): Promise<{ next: CombatState; error?: string }> {
  const next = assignCharacterToPlaceholder(state, options.tokenId, options.character);

  if (options.isDm) {
    const error = await persistCombatState(campaignId, next);
    return { next, error: error ?? undefined };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("claim_combat_character_slot", {
    p_campaign_id: campaignId,
    p_token_id: options.tokenId,
    p_character_id: options.character.id,
  });

  return { next, error: error?.message };
}
