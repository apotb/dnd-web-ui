"use client";

import { useState } from "react";
import type { PendingAttackTarget } from "@/lib/schemas/combat-state";

interface CombatSaveRollModalProps {
  target: PendingAttackTarget;
  saveAbility?: string;
  saveDc?: number;
  onCancel: () => void;
  onSubmit: (saveRoll: number, saveTotal: number) => void;
  submitting?: boolean;
}

function parseIntOrZero(value: string): number {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function CombatSaveRollModal({
  target,
  saveAbility,
  saveDc,
  onCancel,
  onSubmit,
  submitting = false,
}: CombatSaveRollModalProps) {
  const [saveRoll, setSaveRoll] = useState("");
  const [saveMod, setSaveMod] = useState("");
  const saveTotal = parseIntOrZero(saveRoll) + parseIntOrZero(saveMod);

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-save-roll-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">Saving throw</p>
        <p className="retro-muted">
          {target.label} — DC {saveDc ?? "?"}
          {saveAbility ? ` ${saveAbility}` : ""} save
        </p>

        <div className="combat-attack-submit-fields">
          <label className="combat-attack-submit-field">
            <span>d20 roll</span>
            <input
              type="number"
              min={1}
              max={20}
              className="candy-input"
              value={saveRoll}
              onChange={(event) => setSaveRoll(event.target.value)}
              disabled={submitting}
            />
          </label>
          <label className="combat-attack-submit-field">
            <span>Modifier</span>
            <input
              type="number"
              className="candy-input"
              value={saveMod}
              onChange={(event) => setSaveMod(event.target.value)}
              disabled={submitting}
            />
          </label>
          <p className="retro-muted">Total: {saveTotal}</p>
        </div>

        <div className="supply-picker-actions combat-roll-actions">
          <button type="button" className="candy-btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <div className="combat-roll-right-actions">
            <button
              type="button"
              className="candy-btn"
              onClick={() => onSubmit(parseIntOrZero(saveRoll), saveTotal)}
              disabled={submitting || !saveRoll.trim()}
            >
              {submitting ? "Submitting…" : "Submit save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
