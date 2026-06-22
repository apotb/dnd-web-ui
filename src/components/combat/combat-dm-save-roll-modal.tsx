"use client";

import { useState } from "react";
import { parseD20Roll, SaveRollField } from "@/components/combat/combat-roll-fields";
import type { PendingAttackTarget } from "@/lib/schemas/combat-state";

interface CombatDmSaveRollModalProps {
  targets: PendingAttackTarget[];
  saveAbility?: string;
  saveDc?: number;
  onCancel: () => void;
  onSubmit: (saves: Array<{ tokenId: string; saveRoll: number; saveTotal: number }>) => void;
  submitting?: boolean;
}

function parseIntOrZero(value: string): number {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function CombatDmSaveRollModal({
  targets,
  saveAbility,
  saveDc,
  onCancel,
  onSubmit,
  submitting = false,
}: CombatDmSaveRollModalProps) {
  const [rolls, setRolls] = useState<
    Record<string, { saveRoll: string; saveMod: string }>
  >({});

  function handleSubmit() {
    onSubmit(
      targets.map((target) => {
        const entry = rolls[target.tokenId] ?? { saveRoll: "", saveMod: "" };
        const saveRoll = parseD20Roll(entry.saveRoll) ?? 0;
        const saveTotal = saveRoll + parseIntOrZero(entry.saveMod);
        return { tokenId: target.tokenId, saveRoll, saveTotal };
      })
    );
  }

  const allSavesValid = targets.every((target) => {
    const entry = rolls[target.tokenId] ?? { saveRoll: "", saveMod: "" };
    return parseD20Roll(entry.saveRoll) != null;
  });

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-dm-save-roll-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">Enter saving throws</p>
        <p className="retro-muted">
          DC {saveDc ?? "?"}
          {saveAbility ? ` ${saveAbility}` : ""} — enter saves for creatures you control.
        </p>

        <div className="combat-dm-save-roll-list">
          {targets.map((target) => {
            const entry = rolls[target.tokenId] ?? { saveRoll: "", saveMod: "" };
            const saveRollValue = parseD20Roll(entry.saveRoll);
            const total = (saveRollValue ?? 0) + parseIntOrZero(entry.saveMod);
            return (
              <div key={target.tokenId} className="combat-attack-submit-target-block">
                <strong>{target.label}</strong>
                <label className="combat-attack-submit-field">
                  <span>d20</span>
                  <SaveRollField
                    value={entry.saveRoll}
                    onChange={(value) =>
                      setRolls((current) => ({
                        ...current,
                        [target.tokenId]: { ...entry, saveRoll: value },
                      }))
                    }
                    disabled={submitting}
                  />
                </label>
                <label className="combat-attack-submit-field">
                  <span>Mod</span>
                  <input
                    type="number"
                    className="candy-input"
                    value={entry.saveMod}
                    onChange={(event) =>
                      setRolls((current) => ({
                        ...current,
                        [target.tokenId]: { ...entry, saveMod: event.target.value },
                      }))
                    }
                    disabled={submitting}
                  />
                </label>
                <span className="retro-muted">= {total}</span>
              </div>
            );
          })}
        </div>

        <div className="supply-picker-actions combat-roll-actions">
          <button type="button" className="candy-btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <div className="combat-roll-right-actions">
            <button
              type="button"
              className="candy-btn"
              onClick={handleSubmit}
              disabled={submitting || !allSavesValid}
            >
              {submitting ? "Submitting…" : "Submit saves"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
