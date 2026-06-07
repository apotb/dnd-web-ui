"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseCombatantRow, type ParsedCombatant } from "@/lib/character/utils";
import type { Encounter, EncounterCombatant } from "@/lib/types/database";

interface EncounterState {
  encounter: Encounter;
  combatants: ParsedCombatant[];
}

export function useRealtimeEncounter(
  encounterId: string,
  initial: EncounterState
) {
  const [state, setState] = useState(initial);

  useEffect(() => {
    setState(initial);
  }, [initial]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`encounter:${encounterId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "encounters",
          filter: `id=eq.${encounterId}`,
        },
        (payload) => {
          if (payload.eventType !== "DELETE") {
            setState((prev) => ({
              ...prev,
              encounter: payload.new as Encounter,
            }));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "encounter_combatants",
          filter: `encounter_id=eq.${encounterId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id?: string };
            if (old.id) {
              setState((prev) => ({
                ...prev,
                combatants: prev.combatants.filter((c) => c.id !== old.id),
              }));
            }
            return;
          }

          const row = payload.new as EncounterCombatant;
          const parsed = parseCombatantRow(row, true);

          setState((prev) => {
            const idx = prev.combatants.findIndex((c) => c.id === parsed.id);
            if (idx >= 0) {
              const next = [...prev.combatants];
              next[idx] = parsed;
              return { ...prev, combatants: next };
            }
            return {
              ...prev,
              combatants: [...prev.combatants, parsed],
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [encounterId]);

  return state;
}
