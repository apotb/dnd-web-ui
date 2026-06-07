"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CharacterSheet } from "@/components/character/character-sheet";
import { CharacterImportButton } from "@/components/character/character-import-button";
import { useRealtimeCharacters } from "@/lib/hooks/use-realtime-characters";
import type { ParsedCharacter } from "@/lib/character/utils";

interface CharacterSheetsListProps {
  campaignId: string;
  initialCharacters: ParsedCharacter[];
  isDm: boolean;
}

function selectionStorageKey(campaignId: string) {
  return `campaign-character-selection-${campaignId}`;
}

export function CharacterSheetsList({
  campaignId,
  initialCharacters,
  isDm,
}: CharacterSheetsListProps) {
  const characters = useRealtimeCharacters(campaignId, initialCharacters);
  const sortedCharacters = useMemo(
    () => [...characters].sort((a, b) => a.name.localeCompare(b.name)),
    [characters]
  );
  const [selectedId, setSelectedId] = useState("");
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    setRestored(false);
    setSelectedId("");
  }, [campaignId]);

  useEffect(() => {
    if (sortedCharacters.length === 0) {
      setSelectedId("");
      setRestored(false);
      return;
    }

    if (!restored) {
      const stored = localStorage.getItem(selectionStorageKey(campaignId));
      if (stored && sortedCharacters.some((c) => c.id === stored)) {
        setSelectedId(stored);
      }
      setRestored(true);
      return;
    }

    if (selectedId && !sortedCharacters.some((c) => c.id === selectedId)) {
      setSelectedId("");
      localStorage.removeItem(selectionStorageKey(campaignId));
    }
  }, [campaignId, sortedCharacters, selectedId, restored]);

  function selectCharacter(id: string) {
    setSelectedId(id);
    const key = selectionStorageKey(campaignId);
    if (id) {
      localStorage.setItem(key, id);
    } else {
      localStorage.removeItem(key);
    }
  }

  const selectedCharacter = sortedCharacters.find((c) => c.id === selectedId);

  return (
    <div>
      <h2 className="page-title">Characters</h2>
      {isDm ? (
        <p className="retro-dm-actions">
          <CharacterImportButton campaignId={campaignId} />
        </p>
      ) : null}

      {sortedCharacters.length === 0 ? (
        <p className="retro-note">No characters yet.</p>
      ) : (
        <>
          <select
            id="character-select"
            className="candy-input character-select"
            value={selectedId}
            onChange={(e) => selectCharacter(e.target.value)}
          >
            <option value="">Select character</option>
            {sortedCharacters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}
                {character.player_name ? ` · ${character.player_name}` : ""}
              </option>
            ))}
          </select>

          {selectedCharacter ? (
            <section className="retro-box character-sheet-wrap">
              {isDm ? (
                <p className="retro-edit-link">
                  <Link
                    href={`/campaigns/${campaignId}/characters/${selectedCharacter.id}`}
                  >
                    [ edit {selectedCharacter.name} ]
                  </Link>
                </p>
              ) : null}
              <CharacterSheet
                data={selectedCharacter.data}
                isDm={false}
                editable={false}
              />
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
