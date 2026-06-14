"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { CharacterClaimBanner } from "@/components/character/character-claim-banner";
import { CharacterSheet } from "@/components/character/character-sheet";
import { CharacterImportButton } from "@/components/character/character-import-button";
import { useRealtimeCharacters } from "@/lib/hooks/use-realtime-characters";
import type { ParsedCharacter } from "@/lib/character/utils";

interface CharacterSheetsListProps {
  campaignId: string;
  initialCharacters: ParsedCharacter[];
  isDm: boolean;
  userId: string | null;
}

function selectionStorageKey(campaignId: string) {
  return `campaign-character-selection-${campaignId}`;
}

function canEditCharacter(
  character: ParsedCharacter,
  isDm: boolean,
  userId: string | null
) {
  return isDm || (!!userId && character.owner_user_id === userId);
}

function canClaimCharacter(
  character: ParsedCharacter,
  userId: string | null,
  userOwnedCharacterId: string | null
) {
  return (
    !!userId &&
    character.owner_user_id === null &&
    userOwnedCharacterId === null
  );
}

export function CharacterSheetsList({
  campaignId,
  initialCharacters,
  isDm,
  userId,
}: CharacterSheetsListProps) {
  const pathname = usePathname();
  const createCharacterHref = pathname.replace(/\/characters.*$/, "/create-character");
  const characters = useRealtimeCharacters(campaignId, initialCharacters, isDm);
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

  const userOwnedCharacter = useMemo(
    () => (userId ? sortedCharacters.find((c) => c.owner_user_id === userId) : null) ?? null,
    [sortedCharacters, userId]
  );

  const selectedCharacter = sortedCharacters.find((c) => c.id === selectedId);
  const selectedCanEdit = selectedCharacter
    ? canEditCharacter(selectedCharacter, isDm, userId)
    : false;
  const selectedCanClaim = selectedCharacter
    ? canClaimCharacter(
        selectedCharacter,
        userId,
        userOwnedCharacter?.id ?? null
      )
    : false;

  return (
    <div>
      <h2 className="page-title">Characters</h2>

      {sortedCharacters.length === 0 ? (
        <p className="retro-note">No characters yet.</p>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
            {sortedCharacters.map((character) => (
              <button
                key={character.id}
                className={`candy-btn${character.id === selectedId ? " candy-btn-active" : ""}`}
                style={{ flex: "0 1 auto" }}
                onClick={() => selectCharacter(character.id === selectedId ? "" : character.id)}
              >
                {character.name}
              </button>
            ))}
          </div>

          {selectedCharacter ? (
            <>
              {!selectedCanEdit ? (
                <CharacterClaimBanner
                  characterId={selectedCharacter.id}
                  characterName={selectedCharacter.name}
                  campaignId={campaignId}
                  isLoggedIn={!!userId}
                  canClaim={selectedCanClaim}
                  isOwner={false}
                />
              ) : null}
              <section className="retro-box character-sheet-wrap">
                <CharacterSheet
                  data={selectedCharacter.data}
                  isDm={false}
                  editable={false}
                  editHref={selectedCanEdit ? `/campaigns/${campaignId}/characters/${selectedCharacter.id}` : undefined}
                />
              </section>
            </>
          ) : null}
        </>
      )}

      <div style={{ display: "flex", flexDirection: "row", gap: "8px", flexWrap: "wrap", marginTop: "16px" }}>
        <Link href={createCharacterHref} className="candy-btn" style={{ flex: "0 1 auto" }}>
          Create character
        </Link>
        {isDm && <CharacterImportButton campaignId={campaignId} />}
      </div>
    </div>
  );
}
