"use client";

import Link from "next/link";
import { CharacterSheet } from "@/components/character/character-sheet";
import { CharacterImportButton } from "@/components/character/character-import-button";
import { useRealtimeCharacters } from "@/lib/hooks/use-realtime-characters";
import type { ParsedCharacter } from "@/lib/character/utils";

interface CharacterSheetsListProps {
  campaignId: string;
  initialCharacters: ParsedCharacter[];
  isDm: boolean;
}

export function CharacterSheetsList({
  campaignId,
  initialCharacters,
  isDm,
}: CharacterSheetsListProps) {
  const characters = useRealtimeCharacters(campaignId, initialCharacters);

  return (
    <div>
      <div className="retro-header-row">
        <h2 className="page-title">Characters</h2>
        {isDm ? <CharacterImportButton campaignId={campaignId} /> : null}
      </div>

      {characters.length === 0 ? (
        <p className="retro-muted">No characters yet.</p>
      ) : (
        <div className="retro-stack">
          {characters.map((character) => (
            <section key={character.id} className="retro-box">
              {isDm ? (
                <p className="retro-edit-link">
                  <Link href={`/campaigns/${campaignId}/characters/${character.id}`}>
                    [ edit {character.name} ]
                  </Link>
                </p>
              ) : null}
              <CharacterSheet
                data={character.data}
                isDm={false}
                editable={false}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
