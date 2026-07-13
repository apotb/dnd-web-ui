"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCampaignRealtimeColumn } from "@/lib/hooks/campaign-realtime-payload";
import { normalizeCombatState } from "@/lib/combat/state-utils";
import { parseCombatState, type CombatState } from "@/lib/schemas/combat-state";
import type { Campaign, Json } from "@/lib/types/database";

export function useRealtimeCombatState(
  campaignId: string,
  initialCombatState: CombatState
) {
  const [combatState, setCombatState] = useState(() =>
    normalizeCombatState(initialCombatState)
  );

  // Reset only when switching campaigns — not when server props refresh.
  useEffect(() => {
    setCombatState(normalizeCombatState(initialCombatState));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialCombatState read at campaign switch
  }, [campaignId]);

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
          const row = payload.new as Partial<Campaign>;
          const combatState = getCampaignRealtimeColumn(row, "combat_state");
          if (combatState === undefined) return;
          setCombatState(
            normalizeCombatState(parseCombatState(combatState))
          );
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
  const normalized = normalizeCombatState(parseCombatState(combatState));
  const { error } = await supabase
    .from("campaigns")
    .update({ combat_state: normalized as unknown as Json })
    .eq("id", campaignId);

  return error?.message ?? null;
}
