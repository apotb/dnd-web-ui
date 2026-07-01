"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseCharacterRow, type ParsedCharacter } from "@/lib/character/utils";
import type { Character } from "@/lib/types/database";

function toCharacterRow(character: ParsedCharacter): Character {
  return {
    id: character.id,
    campaign_id: character.campaign_id,
    name: character.name,
    player_name: character.player_name,
    owner_user_id: character.owner_user_id,
    data: character.data,
    created_at: character.created_at,
    updated_at: character.updated_at,
  };
}

export function useRealtimeCharacters(
  campaignId: string,
  initialCharacters: ParsedCharacter[],
  isDm: boolean,
  options?: { enabled?: boolean; includeDmData?: boolean }
) {
  const includeDmData = options?.includeDmData ?? isDm;
  const [characters, setCharacters] = useState(initialCharacters);
  const rawRowsRef = useRef<Map<string, Character>>(new Map());
  const subscriptionId = useId().replace(/:/g, "");
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    const nextRaw = new Map<string, Character>();
    for (const character of initialCharacters) {
      nextRaw.set(character.id, toCharacterRow(character));
    }
    rawRowsRef.current = nextRaw;
    setCharacters(
      initialCharacters.map((character) =>
        parseCharacterRow(toCharacterRow(character), includeDmData)
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialCharacters read at campaign switch
  }, [campaignId]);

  useEffect(() => {
    setCharacters((prev) =>
      prev.map((character) => {
        const raw =
          rawRowsRef.current.get(character.id) ?? toCharacterRow(character);
        return parseCharacterRow(raw, includeDmData);
      })
    );
  }, [includeDmData]);

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`characters:${campaignId}:${subscriptionId}`)
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
              rawRowsRef.current.delete(old.id);
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

            rawRowsRef.current.set(merged.id, merged);
            const parsed = parseCharacterRow(merged, includeDmData);

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
  }, [campaignId, enabled, includeDmData, subscriptionId]);

  return characters;
}
