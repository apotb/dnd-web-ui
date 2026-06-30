"use client";

import type { ParsedCharacter } from "@/lib/character/utils";
import { getCharacterPortraitUrl } from "@/lib/character/portrait-storage";
import { createClient } from "@/lib/supabase/client";

interface CharacterSlotClaimModalProps {
  characterName: string;
  onConfirm: () => void;
  onCancel: () => void;
  claiming: boolean;
}

export function CharacterSlotClaimModal({
  characterName,
  onConfirm,
  onCancel,
  claiming,
}: CharacterSlotClaimModalProps) {
  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-character-slot-modal combat-character-slot-claim-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">Claim token?</p>
        <p className="retro-muted">
          Would you like to claim this token as {characterName}?
        </p>
        <div className="supply-picker-actions combat-roll-actions">
          <button type="button" className="candy-btn" onClick={onCancel} disabled={claiming}>
            No
          </button>
          <div className="combat-roll-right-actions">
            <button
              type="button"
              className="candy-btn"
              onClick={onConfirm}
              disabled={claiming}
            >
              {claiming ? "Claiming…" : "Yes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CharacterSlotAssignModalProps {
  tokenLabel: string;
  characters: ParsedCharacter[];
  presentCharacterIds: Set<string>;
  onAssign: (characterId: string) => void;
  onRemove: () => void;
  onCancel: () => void;
  submitting: boolean;
}

export function CharacterSlotAssignModal({
  tokenLabel,
  characters,
  presentCharacterIds,
  onAssign,
  onRemove,
  onCancel,
  submitting,
}: CharacterSlotAssignModalProps) {
  const supabase = createClient();
  const available = characters
    .filter((character) => !presentCharacterIds.has(character.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-character-slot-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">{tokenLabel}</p>
        <p className="retro-muted">Assign a party member to this token.</p>

        {available.length > 0 ? (
          <ul className="combat-character-slot-assign-list">
            {available.map((character) => {
              const portraitUrl = character.data.basicInfo.portrait
                ? getCharacterPortraitUrl(supabase, character.data.basicInfo.portrait)
                : null;
              return (
                <li key={character.id}>
                  <button
                    type="button"
                    className="combat-character-slot-assign-option"
                    disabled={submitting}
                    onClick={() => onAssign(character.id)}
                  >
                    {portraitUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={portraitUrl} alt="" className="combat-character-slot-assign-portrait" />
                    ) : (
                      <div className="combat-character-slot-assign-portrait combat-character-slot-assign-portrait-fallback">
                        {character.name.slice(0, 1)}
                      </div>
                    )}
                    <span>{character.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="retro-muted">All party members are already on the board.</p>
        )}

        <div className="supply-picker-actions combat-roll-actions">
          <button type="button" className="candy-btn candy-btn-danger" onClick={onRemove} disabled={submitting}>
            Remove token
          </button>
          <button type="button" className="candy-btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
