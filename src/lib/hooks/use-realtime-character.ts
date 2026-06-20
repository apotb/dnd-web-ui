"use client";

import { useEffect, useState } from "react";
import { parseCharacterRow, type ParsedCharacter } from "@/lib/character/utils";
import { createClient } from "@/lib/supabase/client";
import type { Character } from "@/lib/types/database";

export function useRealtimeCharacter(
  characterId: string | null,
  initialCharacter: ParsedCharacter | null,
  isDm: boolean
) {
  const [character, setCharacter] = useState(initialCharacter);

  useEffect(() => {
    setCharacter(initialCharacter);
  }, [initialCharacter]);

  useEffect(() => {
    if (!characterId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`character:${characterId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "characters",
          filter: `id=eq.${characterId}`,
        },
        (payload) => {
          const row = payload.new as Character;
          setCharacter(parseCharacterRow(row, isDm));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [characterId, isDm]);

  return character;
}
