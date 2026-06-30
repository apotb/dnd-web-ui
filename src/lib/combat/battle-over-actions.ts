"use client";

import { createClient } from "@/lib/supabase/client";
import { removeTokenFromState } from "@/lib/combat/state-utils";
import { isBattleOver, isTokenOnMapEdge } from "@/lib/combat/battle-over";
import { canUserActForToken } from "@/lib/combat/turn";
import { persistCombatState } from "@/lib/hooks/use-realtime-combat-state";
import type { ParsedCharacter } from "@/lib/character/utils";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";

export function canLeaveCombatArea(
  state: CombatState,
  token: CombatToken,
  character: ParsedCharacter | null,
  userId: string | null,
  isDm: boolean
): boolean {
  if (!isBattleOver(state)) return false;
  if (token.kind !== "party") return false;
  if (!isTokenOnMapEdge(token, state)) return false;
  return canUserActForToken(userId, isDm, token, character);
}

export async function leaveCombatArea(
  campaignId: string,
  state: CombatState,
  options: {
    isDm: boolean;
    tokenId: string;
  }
): Promise<{ next: CombatState; error?: string }> {
  const token = state.tokens.find((entry) => entry.id === options.tokenId);
  if (!token) {
    return { next: state, error: "Combatant not found." };
  }

  if (!isBattleOver(state)) {
    return { next: state, error: "Battle is not over yet." };
  }

  if (token.kind !== "party") {
    return { next: state, error: "Only party characters can leave the area." };
  }

  if (!isTokenOnMapEdge(token, state)) {
    return { next: state, error: "You must be on the edge of the map to leave." };
  }

  const next = removeTokenFromState(state, options.tokenId);

  if (options.isDm) {
    const error = await persistCombatState(campaignId, next);
    return { next, error: error ?? undefined };
  }

  const supabase = createClient();
  const { error } = await supabase.rpc("leave_combat_area", {
    p_campaign_id: campaignId,
    p_token_id: options.tokenId,
  });

  return { next, error: error?.message };
}
