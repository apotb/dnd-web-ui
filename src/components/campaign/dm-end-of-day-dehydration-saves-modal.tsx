"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatHarptosDate, type HarptosDate } from "@/lib/dnd/harptos-calendar";
import { formatModifier } from "@/lib/dnd/calculations";
import {
  DEHYDRATION_SAVE_DC,
  formatGallons,
  getConModifier,
  getDehydrationSaveFailureLevelsForExhaustion,
} from "@/lib/dnd/survival";
import { getDehydrationSavePreviewForSupplies } from "@/lib/campaign/advance-day";
import type { EndOfDaySuppliesChoice } from "@/lib/dnd/supplies";
import type { ParsedCharacter } from "@/lib/character/utils";
import type { WorldData } from "@/lib/schemas/world";

interface DmEndOfDayDehydrationSavesModalProps {
  characters: ParsedCharacter[];
  suppliesChoices: Record<string, EndOfDaySuppliesChoice>;
  endingDate: HarptosDate;
  worldData: WorldData;
  onConfirm: (rolls: Record<string, number>) => void;
  onCancel: () => void;
  saving: boolean;
}

function DehydrationSaveRow({
  character,
  endingDate,
  worldData,
  suppliesChoice,
  roll,
  disabled,
  onRollChange,
}: {
  character: ParsedCharacter;
  endingDate: HarptosDate;
  worldData: WorldData;
  suppliesChoice: EndOfDaySuppliesChoice;
  roll: string;
  disabled: boolean;
  onRollChange: (value: string) => void;
}) {
  const preview = getDehydrationSavePreviewForSupplies(
    character.data,
    endingDate,
    worldData,
    suppliesChoice
  );
  const conMod = getConModifier(character.data);
  const rollValue = parseInt(roll, 10);
  const hasValidRoll =
    Number.isFinite(rollValue) && rollValue >= 1 && rollValue <= 20;
  const rollTotal = hasValidRoll ? rollValue + conMod : null;
  const passed = rollTotal !== null && rollTotal >= DEHYDRATION_SAVE_DC;
  const failureLevels = getDehydrationSaveFailureLevelsForExhaustion(
    preview.exhaustionBeforeCheck
  );

  return (
    <li className="dm-end-of-day-supplies-row dm-end-of-day-dehydration-row">
      <div className="dm-end-of-day-supplies-character">
        <strong>{character.name}</strong>
        <span className="retro-muted dm-end-of-day-supplies-tag">
          {formatGallons(preview.gallonsDrunk)} gal — half water
        </span>
      </div>
      <p className="retro-muted dm-end-of-day-dehydration-note">
        Constitution save DC {DEHYDRATION_SAVE_DC}. On a failure, gains{" "}
        {failureLevels} exhaustion.
      </p>
      <div className="dehydration-save-roll-row">
        <input
          className="candy-input dehydration-save-roll-input"
          type="number"
          min={1}
          max={20}
          placeholder="d20"
          value={roll}
          onChange={(event) => onRollChange(event.target.value)}
          disabled={disabled}
          aria-label={`d20 roll for ${character.name}`}
        />
        <span className="dehydration-save-roll-mod">{formatModifier(conMod)}</span>
        <span className="dehydration-save-roll-total" aria-live="polite">
          = {rollTotal ?? "—"}
        </span>
      </div>
      {hasValidRoll ? (
        <p
          className={`dm-end-of-day-dehydration-outcome${
            passed ? "" : " dm-end-of-day-dehydration-outcome-fail"
          }`}
        >
          {passed
            ? "Pass — no exhaustion from dehydration"
            : `Fail — +${failureLevels} exhaustion from dehydration`}
        </p>
      ) : null}
    </li>
  );
}

export function DmEndOfDayDehydrationSavesModal({
  characters,
  suppliesChoices,
  endingDate,
  worldData,
  onConfirm,
  onCancel,
  saving,
}: DmEndOfDayDehydrationSavesModalProps) {
  const [mounted, setMounted] = useState(false);
  const [rolls, setRolls] = useState<Record<string, string>>(() =>
    Object.fromEntries(characters.map((character) => [character.id, ""]))
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const allRollsValid = characters.every((character) => {
    const rollValue = parseInt(rolls[character.id] ?? "", 10);
    return Number.isFinite(rollValue) && rollValue >= 1 && rollValue <= 20;
  });

  function submit() {
    if (!allRollsValid) {
      setMessage("Enter a d20 roll (1–20) for each character.");
      return;
    }

    const rollTotals = Object.fromEntries(
      characters.map((character) => {
        const rollValue = parseInt(rolls[character.id] ?? "", 10);
        return [
          character.id,
          rollValue + getConModifier(character.data),
        ];
      })
    );

    onConfirm(rollTotals);
  }

  const modal = (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box dm-end-of-day-supplies-modal dm-end-of-day-dehydration-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">Dehydration saves</p>
        <p className="retro-muted dm-end-of-day-supplies-intro">
          These characters drank half their daily water on{" "}
          {formatHarptosDate(endingDate)}. Roll Constitution saves before the
          day advances.
        </p>
        <ul className="dm-end-of-day-supplies-list">
          {characters.map((character) => {
            const suppliesChoice = suppliesChoices[character.id];
            if (!suppliesChoice) return null;

            return (
              <DehydrationSaveRow
                key={character.id}
                character={character}
                endingDate={endingDate}
                worldData={worldData}
                suppliesChoice={suppliesChoice}
                roll={rolls[character.id] ?? ""}
                disabled={saving}
                onRollChange={(value) =>
                  setRolls((current) => ({
                    ...current,
                    [character.id]: value,
                  }))
                }
              />
            );
          })}
        </ul>
        {message ? <p className="retro-muted">{message}</p> : null}
        <div className="supply-picker-actions">
          <button
            type="button"
            className="candy-btn"
            onClick={onCancel}
            disabled={saving}
          >
            Back
          </button>
          <button
            type="button"
            className="candy-btn"
            onClick={submit}
            disabled={saving || !allRollsValid}
          >
            {saving ? "..." : "Next Day"}
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
