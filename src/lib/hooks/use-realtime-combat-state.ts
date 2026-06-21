"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizeCombatTokens } from "@/lib/combat/state-utils";
import { parseCombatState, type CombatState } from "@/lib/schemas/combat-state";
import type { Campaign } from "@/lib/types/database";

export function useRealtimeCombatState(
  campaignId: string,
  initialCombatState: CombatState
) {
  const [combatState, setCombatState] = useState(normalizeCombatTokens(initialCombatState));

  useEffect(() => {
    setCombatState(normalizeCombatTokens(initialCombatState));
  }, [initialCombatState]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`campaign-combat:${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "campaigns",
          filter: `id=eq.${campaignId}`,
        },
        (payload) => {
          const row = payload.new as Campaign;
          setCombatState(normalizeCombatTokens(parseCombatState(row.combat_state ?? {})));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  return combatState;
}

export async function persistCombatState(
  campaignId: string,
  combatState: CombatState
): Promise<string | null> {
  const supabase = createClient();
  const { error } = await supabase
    .from("campaigns")
    .update({ combat_state: combatState })
    .eq("id", campaignId);

  return error?.message ?? null;
}
