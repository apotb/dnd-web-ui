"use client";

import { useState } from "react";
import { parseD20Roll, SaveRollField } from "@/components/combat/combat-roll-fields";
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
  const saveRollValue = parseD20Roll(saveRoll);
  const saveTotal = (saveRollValue ?? 0) + parseIntOrZero(saveMod);
  const canSubmit = saveRollValue != null;

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
            <SaveRollField
              value={saveRoll}
              onChange={setSaveRoll}
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
              onClick={() => {
                if (saveRollValue == null) return;
                onSubmit(saveRollValue, saveTotal);
              }}
              disabled={submitting || !canSubmit}
            >
              {submitting ? "Submitting…" : "Submit save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
