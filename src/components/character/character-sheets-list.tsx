"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CharacterClaimBanner } from "@/components/character/character-claim-banner";
import { CharacterSheetViewer } from "@/components/character/character-sheet-viewer";
import { CharacterImportButton } from "@/components/character/character-import-button";
import { useRealtimeCharacters } from "@/lib/hooks/use-realtime-characters";
import type { ParsedCharacter } from "@/lib/character/utils";
import type { PhbClass } from "@/lib/dnd/phb/types";

interface CharacterSheetsListProps {
  campaignId: string;
  initialCharacters: ParsedCharacter[];
  classes: PhbClass[];
  isDm: boolean;
  userId: string | null;
  hideTitle?: boolean;
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
  classes,
  isDm,
  userId,
  hideTitle = false,
}: CharacterSheetsListProps) {
  const searchParams = useSearchParams();
  const createCharacterHref = `/campaigns/${campaignId}/create-character`;
  const characters = useRealtimeCharacters(campaignId, initialCharacters, isDm);
  const sortedCharacters = useMemo(() => {
    return [...characters].sort((a, b) => {
      const aOwned = !!userId && a.owner_user_id === userId;
      const bOwned = !!userId && b.owner_user_id === userId;
      if (aOwned !== bOwned) return aOwned ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [characters, userId]);
  const [selectedId, setSelectedId] = useState("");
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    setRestored(false);
    setSelectedId("");
  }, [campaignId]);

  useEffect(() => {
    const fromQuery = searchParams.get("character");
    if (!fromQuery || !sortedCharacters.some((c) => c.id === fromQuery)) return;
    setSelectedId(fromQuery);
    localStorage.setItem(selectionStorageKey(campaignId), fromQuery);
  }, [campaignId, searchParams, sortedCharacters]);

  useEffect(() => {
    if (sortedCharacters.length === 0) {
      setSelectedId("");
      setRestored(false);
      return;
    }

    if (!restored) {
      const fromQuery = searchParams.get("character");
      if (!fromQuery) {
        const stored = localStorage.getItem(selectionStorageKey(campaignId));
        if (stored && sortedCharacters.some((c) => c.id === stored)) {
          setSelectedId(stored);
        }
      }
      setRestored(true);
      return;
    }

    if (selectedId && !sortedCharacters.some((c) => c.id === selectedId)) {
      setSelectedId("");
      localStorage.removeItem(selectionStorageKey(campaignId));
    }
  }, [campaignId, sortedCharacters, selectedId, restored, searchParams]);

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
      {!hideTitle ? <h2 className="page-title">Characters</h2> : null}

      {sortedCharacters.length === 0 ? (
        <p className="retro-note">No characters yet.</p>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
            {sortedCharacters.map((character) => {
              const isUserCharacter =
                !!userId && character.owner_user_id === userId;

              return (
              <button
                key={character.id}
                className={`candy-btn${character.id === selectedId ? " candy-btn-active" : ""}`}
                style={{ flex: "0 1 auto", display: "inline-flex", alignItems: "center", gap: "6px" }}
                onClick={() => selectCharacter(character.id === selectedId ? "" : character.id)}
              >
                {isUserCharacter ? (
                  <span className="character-owned-star" aria-hidden>
                    ★
                  </span>
                ) : null}
                {character.name}
              </button>
              );
            })}
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
                />
              ) : null}
              <section className="retro-box character-sheet-wrap">
                <CharacterSheetViewer
                  character={selectedCharacter}
                  campaignId={campaignId}
                  classes={classes}
                  isDm={isDm}
                  canEdit={selectedCanEdit}
                  canDelete={isDm}
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
