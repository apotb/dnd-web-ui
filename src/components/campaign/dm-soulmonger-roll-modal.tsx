"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatHarptosDate, type HarptosDate } from "@/lib/dnd/harptos-calendar";
import { interpretSoulmongerRoll } from "@/lib/schemas/soulmonger";
import type { SoulmongerActiveSoul } from "@/lib/schemas/soulmonger";

interface DmSoulmongerRollModalProps {
  souls: SoulmongerActiveSoul[];
  endingDate: HarptosDate;
  onConfirm: (rolls: Record<string, number>) => void;
  onCancel: () => void;
  onBack: () => void;
  saving: boolean;
}

function SoulmongerRollRow({
  soul,
  roll,
  disabled,
  onRollChange,
}: {
  soul: SoulmongerActiveSoul;
  roll: string;
  disabled: boolean;
  onRollChange: (value: string) => void;
}) {
  const rollValue = parseInt(roll, 10);
  const hasValidRoll =
    Number.isFinite(rollValue) && rollValue >= 1 && rollValue <= 20;
  const outcome = hasValidRoll ? interpretSoulmongerRoll(rollValue) : null;
  const displayName = soul.name.trim() || "Unnamed soul";

  return (
    <li className="dm-end-of-day-supplies-row dm-soulmonger-roll-row">
      <div className="dm-end-of-day-supplies-character">
        <strong>{displayName}</strong>
      </div>
      <p className="retro-muted dm-end-of-day-dehydration-note">
        Roll d20. On a 1, this soul is devoured.
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
          aria-label={`d20 roll for ${displayName}`}
        />
      </div>
      {hasValidRoll ? (
        <p
          className={`dm-end-of-day-dehydration-outcome${
            outcome === "devoured"
              ? " dm-end-of-day-dehydration-outcome-fail"
              : ""
          }`}
        >
          {outcome === "devoured" ? "Devoured" : "Survives"}
        </p>
      ) : null}
    </li>
  );
}

export function DmSoulmongerRollModal({
  souls,
  endingDate,
  onConfirm,
  onCancel,
  onBack,
  saving,
}: DmSoulmongerRollModalProps) {
  const [mounted, setMounted] = useState(false);
  const [rolls, setRolls] = useState<Record<string, string>>(() =>
    Object.fromEntries(souls.map((soul) => [soul.id, ""]))
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const allRollsValid = souls.every((soul) => {
    const rollValue = parseInt(rolls[soul.id] ?? "", 10);
    return Number.isFinite(rollValue) && rollValue >= 1 && rollValue <= 20;
  });

  function submit() {
    if (!allRollsValid) {
      setMessage("Enter a d20 roll (1–20) for each soul.");
      return;
    }

    const rollValues = Object.fromEntries(
      souls.map((soul) => [soul.id, parseInt(rolls[soul.id] ?? "", 10)])
    );

    onConfirm(rollValues);
  }

  const modal = (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box dm-end-of-day-supplies-modal dm-soulmonger-roll-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">Soulmonger</p>
        <p className="retro-muted dm-end-of-day-supplies-intro">
          Roll for each soul in the Soulmonger on{" "}
          {formatHarptosDate(endingDate)} before the day advances.
        </p>
        <ul className="dm-end-of-day-supplies-list">
          {souls.map((soul) => (
            <SoulmongerRollRow
              key={soul.id}
              soul={soul}
              roll={rolls[soul.id] ?? ""}
              disabled={saving}
              onRollChange={(value) =>
                setRolls((current) => ({
                  ...current,
                  [soul.id]: value,
                }))
              }
            />
          ))}
        </ul>
        {message ? <p className="retro-muted">{message}</p> : null}
        <div className="supply-picker-actions">
          <button
            type="button"
            className="candy-btn"
            onClick={onBack}
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
