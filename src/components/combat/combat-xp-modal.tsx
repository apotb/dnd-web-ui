"use client";

import { useEffect, useMemo, useState } from "react";
import type { ParsedCharacter } from "@/lib/character/utils";
import { previewXpDistribution } from "@/lib/combat/xp-pool";
import { getCharacterLevel } from "@/lib/dnd/xp";

export interface CombatXpModalProps {
  open: boolean;
  xpPool: number;
  characters: ParsedCharacter[];
  participantCharacterIds: string[];
  distributing: boolean;
  defaultAllyCount?: number;
  onClose: () => void;
  onDistribute: (selectedCharacterIds: string[], allyCount: number) => void;
}

function sortByName(characters: ParsedCharacter[]): ParsedCharacter[] {
  return [...characters].sort((a, b) => a.name.localeCompare(b.name));
}

function CharacterCheckboxRow({
  character,
  checked,
  onToggle,
}: {
  character: ParsedCharacter;
  checked: boolean;
  onToggle: () => void;
}) {
  const xp = character.data.basicInfo.xp ?? 0;
  const level = getCharacterLevel(character.data);

  return (
    <li>
      <label className="add-party-member-item combat-xp-character-item">
        <input type="checkbox" checked={checked} onChange={onToggle} />
        <span className="add-party-member-name">{character.name}</span>
        <span className="combat-xp-character-meta">
          Lv {level} · {xp.toLocaleString()} XP
        </span>
      </label>
    </li>
  );
}

export function CombatXpModal({
  open,
  xpPool,
  characters,
  participantCharacterIds,
  distributing,
  defaultAllyCount = 0,
  onClose,
  onDistribute,
}: CombatXpModalProps) {
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(participantCharacterIds)
  );
  const [allyCount, setAllyCount] = useState(String(defaultAllyCount));

  useEffect(() => {
    if (!open) return;
    setAllyCount(String(defaultAllyCount));
  }, [open, defaultAllyCount]);

  const participantIdSet = useMemo(
    () => new Set(participantCharacterIds),
    [participantCharacterIds]
  );

  const { participants, nonParticipants } = useMemo(() => {
    const participantsList: ParsedCharacter[] = [];
    const nonParticipantsList: ParsedCharacter[] = [];

    for (const character of characters) {
      if (participantIdSet.has(character.id)) {
        participantsList.push(character);
      } else {
        nonParticipantsList.push(character);
      }
    }

    return {
      participants: sortByName(participantsList),
      nonParticipants: sortByName(nonParticipantsList),
    };
  }, [characters, participantIdSet]);

  const parsedAllyCount = useMemo(() => {
    const parsed = parseInt(allyCount, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  }, [allyCount]);

  const preview = useMemo(
    () => previewXpDistribution(xpPool, selectedIds.size, parsedAllyCount),
    [xpPool, selectedIds.size, parsedAllyCount]
  );

  if (!open) return null;

  function toggleCharacter(characterId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(characterId)) {
        next.delete(characterId);
      } else {
        next.add(characterId);
      }
      return next;
    });
  }

  function handleDistribute() {
    onDistribute([...selectedIds], parsedAllyCount);
  }

  const canDistribute = xpPool > 0 && selectedIds.size > 0 && !distributing;

  function renderCharacterList(list: ParsedCharacter[]) {
    return (
      <ul className="add-party-member-list combat-xp-character-list">
        {list.map((character) => (
          <CharacterCheckboxRow
            key={character.id}
            character={character}
            checked={selectedIds.has(character.id)}
            onToggle={() => toggleCharacter(character.id)}
          />
        ))}
      </ul>
    );
  }

  return (
    <div className="supply-picker-overlay" onClick={onClose}>
      <div
        className="supply-picker-modal retro-box combat-xp-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">Distribute XP</p>
        <p className="retro-muted combat-xp-pool-total">
          Pool: <strong>{xpPool.toLocaleString()} XP</strong>
        </p>

        <label className="combat-xp-allies-row">
          <span>Allies (split only, no XP awarded)</span>
          <input
            type="number"
            className="combat-xp-allies-input"
            min={0}
            value={allyCount}
            onChange={(event) => setAllyCount(event.target.value)}
          />
        </label>

        {preview ? (
          <p className="retro-muted combat-xp-preview">
            {preview.partyTotal.toLocaleString()} XP to party
            {preview.minEach === preview.maxEach
              ? ` (${preview.minEach} each)`
              : ` (${preview.minEach}–${preview.maxEach} each)`}
            {parsedAllyCount > 0
              ? ` · ${selectedIds.size + parsedAllyCount} shares`
              : null}
          </p>
        ) : xpPool > 0 && selectedIds.size === 0 ? (
          <p className="retro-muted combat-xp-preview">Select party members to receive XP.</p>
        ) : null}

        {characters.length === 0 ? (
          <p className="retro-muted">No characters in this campaign.</p>
        ) : participants.length === 0 && nonParticipants.length === 0 ? null : (
          <div className="combat-xp-character-sections">
            {participants.length > 0 ? (
              <section>
                <p className="combat-xp-section-label">Participants</p>
                {renderCharacterList(participants)}
              </section>
            ) : null}
            {nonParticipants.length > 0 ? (
              <section>
                <p
                  className={`combat-xp-section-label${participants.length > 0 ? " combat-xp-section-label-spaced" : ""}`}
                >
                  Non-participants
                </p>
                {renderCharacterList(nonParticipants)}
              </section>
            ) : null}
          </div>
        )}

        <div className="supply-picker-actions add-party-member-actions">
          <button type="button" className="candy-btn" onClick={onClose} disabled={distributing}>
            Cancel
          </button>
          <button
            type="button"
            className="candy-btn candy-btn-success"
            onClick={handleDistribute}
            disabled={!canDistribute}
          >
            {distributing ? "Distributing…" : "Distribute XP"}
          </button>
        </div>
      </div>
    </div>
  );
}
