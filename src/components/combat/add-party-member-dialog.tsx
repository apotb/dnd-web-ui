"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCharacterPortraitUrl } from "@/lib/character/portrait-storage";
import type { ParsedCharacter } from "@/lib/character/utils";

interface AddPartyMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  characters: ParsedCharacter[];
  presentCharacterIds: Set<string>;
  onConfirm: (characters: ParsedCharacter[]) => void;
}

export function AddPartyMemberDialog({
  open,
  onOpenChange,
  characters,
  presentCharacterIds,
  onConfirm,
}: AddPartyMemberDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const supabase = useMemo(() => createClient(), []);

  const available = useMemo(
    () =>
      [...characters]
        .filter((character) => !presentCharacterIds.has(character.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [characters, presentCharacterIds]
  );

  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
    }
  }, [open]);

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

  function handleConfirm() {
    const selected = available.filter((character) => selectedIds.has(character.id));
    onConfirm(selected);
    onOpenChange(false);
  }

  return (
    <div className="supply-picker-overlay">
      <div className="supply-picker-modal retro-box add-party-member-modal">
        <p className="retro-box-title">Add party members</p>
        <p className="retro-muted add-party-member-summary">
          Select characters to place on the combat board.
        </p>

        {available.length === 0 ? (
          <p className="retro-muted">Everyone in the party is already on the board.</p>
        ) : (
          <ul className="add-party-member-list">
            {available.map((character) => {
              const portraitPath = character.data.basicInfo.portrait;
              const portraitUrl = portraitPath
                ? getCharacterPortraitUrl(supabase, portraitPath)
                : null;
              const checked = selectedIds.has(character.id);

              return (
                <li key={character.id}>
                  <label className="add-party-member-item">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCharacter(character.id)}
                    />
                    {portraitUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={portraitUrl}
                        alt=""
                        className="add-party-member-portrait"
                        draggable={false}
                      />
                    ) : (
                      <div className="add-party-member-portrait add-party-member-portrait-fallback">
                        {character.name.slice(0, 1)}
                      </div>
                    )}
                    <span className="add-party-member-name">{character.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <div className="supply-picker-actions add-party-member-actions">
          <button
            type="button"
            className="candy-btn"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="candy-btn"
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
          >
            Add party members
          </button>
        </div>
      </div>
    </div>
  );
}
