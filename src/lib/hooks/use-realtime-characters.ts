"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseCharacterRow, type ParsedCharacter } from "@/lib/character/utils";
import type { Character } from "@/lib/types/database";

export function useRealtimeCharacters(
  campaignId: string,
  initialCharacters: ParsedCharacter[],
  isDm: boolean
) {
  const [characters, setCharacters] = useState(initialCharacters);

  useEffect(() => {
    setCharacters(initialCharacters);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialCharacters read at campaign switch
  }, [campaignId]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`characters:${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "characters",
          filter: `campaign_id=eq.${campaignId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id?: string };
            if (old.id) {
              setCharacters((prev) => prev.filter((c) => c.id !== old.id));
            }
            return;
          }

          const row = payload.new as Partial<Character> & { id?: string };
          if (!row.id) return;

          setCharacters((prev) => {
            const idx = prev.findIndex((c) => c.id === row.id);
            const existing = idx >= 0 ? prev[idx] : null;

            const merged: Character = {
              id: row.id!,
              campaign_id: row.campaign_id ?? existing?.campaign_id ?? campaignId,
              name: row.name ?? existing?.name ?? "",
              player_name: row.player_name ?? existing?.player_name ?? "",
              owner_user_id:
                row.owner_user_id !== undefined
                  ? row.owner_user_id
                  : (existing?.owner_user_id ?? null),
              data: row.data ?? existing?.data ?? {},
              created_at: row.created_at ?? existing?.created_at ?? "",
              updated_at: row.updated_at ?? existing?.updated_at ?? "",
            };

            const parsed = parseCharacterRow(merged, isDm);

            if (idx >= 0) {
              const next = [...prev];
              next[idx] = parsed;
              return next;
            }
            return [...prev, parsed];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId, isDm]);

  return characters;
}
