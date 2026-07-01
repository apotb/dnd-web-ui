"use client";

import { CharacterList } from "@/components/character/character-list";
import { useShowDmUi } from "@/components/layout/dm-view-provider";
import { useRealtimeCharacters } from "@/lib/hooks/use-realtime-characters";
import type { ParsedCharacter } from "@/lib/character/utils";

interface CharacterListClientProps {
  campaignId: string;
  initialCharacters: ParsedCharacter[];
  isDm: boolean;
}

export function CharacterListClient({
  campaignId,
  initialCharacters,
  isDm,
}: CharacterListClientProps) {
  const showDmUi = useShowDmUi(isDm);
  const characters = useRealtimeCharacters(campaignId, initialCharacters, isDm, {
    includeDmData: showDmUi,
  });

  return (
    <CharacterList
      campaignId={campaignId}
      characters={characters}
      isDm={isDm}
    />
  );
}
