"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseCharacterRow, type ParsedCharacter } from "@/lib/character/utils";
import type { Character } from "@/lib/types/database";

export function useRealtimeCharacters(
  campaignId: string,
  initialCharacters: ParsedCharacter[]
) {
  const [characters, setCharacters] = useState(initialCharacters);

  useEffect(() => {
    setCharacters(initialCharacters);
  }, [initialCharacters]);

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

          const row = payload.new as Character;
          const parsed = parseCharacterRow(row, true);

          setCharacters((prev) => {
            const idx = prev.findIndex((c) => c.id === parsed.id);
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
  }, [campaignId]);

  return characters;
}
