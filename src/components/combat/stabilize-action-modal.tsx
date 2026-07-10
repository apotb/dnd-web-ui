"use client";

import { useState } from "react";
import { getSkillTotal, formatModifier } from "@/lib/dnd/calculations";
import { parseD20Roll, sanitizeDieRollInput } from "@/lib/dnd/dice";
import type { CharacterData } from "@/lib/schemas/character";

const STABILIZE_MEDICINE_DC = 10;

interface StabilizeActionModalProps {
  actorData: CharacterData;
  targetLabel: string;
  hasHealersKit: boolean;
  viaSpell?: boolean;
  onCancel: () => void;
  onStabilize: () => void;
}

type Step = "choose" | "roll" | "result";

export function StabilizeActionModal({
  actorData,
  targetLabel,
  hasHealersKit,
  viaSpell = false,
  onCancel,
  onStabilize,
}: StabilizeActionModalProps) {
  const [step, setStep] = useState<Step>(viaSpell ? "result" : hasHealersKit ? "choose" : "roll");
  const [rollInput, setRollInput] = useState("");
  const [usedKit, setUsedKit] = useState(false);

  const medicineMod = getSkillTotal(actorData, "medicine");
  const rollValue = parseD20Roll(rollInput);
  const hasValidRoll = rollValue != null;
  const total = rollValue != null ? rollValue + medicineMod : null;
  const succeeded =
    viaSpell || usedKit || (total != null && total >= STABILIZE_MEDICINE_DC);

  function confirmStabilize() {
    if (!succeeded) return;
    onStabilize();
  }

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box death-save-roll-modal"
        onClick={(event) => event.stopPropagation()}
      >
        {viaSpell ? (
          <>
            <p className="retro-box-title">Spare the Dying</p>
            <p className="retro-muted">
              Stabilize <strong>{targetLabel}</strong> without a Medicine check.
            </p>
            <div className="supply-picker-actions death-save-roll-actions death-save-roll-actions--single">
              <button type="button" className="candy-btn" onClick={confirmStabilize}>
                Stabilize
              </button>
            </div>
          </>
        ) : step === "choose" ? (
          <>
            <p className="retro-box-title">Stabilize</p>
            <p className="retro-muted">
              Stabilize <strong>{targetLabel}</strong> at 0 hit points.
            </p>
            <div className="supply-picker-actions death-save-roll-actions">
              <button type="button" className="candy-btn" onClick={onCancel}>
                Cancel
              </button>
              <button
                type="button"
                className="candy-btn"
                onClick={() => {
                  setUsedKit(true);
                  setStep("result");
                }}
              >
                Use Healer&apos;s Kit
              </button>
              <button
                type="button"
                className="candy-btn"
                onClick={() => setStep("roll")}
              >
                Medicine Check
              </button>
            </div>
            <p className="retro-muted death-save-roll-lead">
              A healer&apos;s kit use is not tracked automatically — mark one use on
              your sheet if applicable.
            </p>
          </>
        ) : step === "roll" ? (
          <>
            <p className="retro-box-title">Medicine check</p>
            <p className="retro-muted">
              DC {STABILIZE_MEDICINE_DC} Wisdom (Medicine) to stabilize{" "}
              <strong>{targetLabel}</strong>.
            </p>
            <p className="retro-muted">
              Medicine modifier: {formatModifier(medicineMod)}
            </p>
            <label className="death-save-roll-field">
              <span>d20 roll</span>
              <input
                className="candy-input initiative-roll-input"
                type="text"
                inputMode="numeric"
                placeholder="d20"
                value={rollInput}
                onChange={(event) =>
                  setRollInput(sanitizeDieRollInput(event.target.value, 20))
                }
                autoFocus
                aria-label="d20 roll"
                aria-invalid={rollInput.trim().length > 0 && !hasValidRoll}
              />
            </label>
            <div className="supply-picker-actions death-save-roll-actions">
              <button type="button" className="candy-btn" onClick={onCancel}>
                Cancel
              </button>
              <button
                type="button"
                className="candy-btn"
                onClick={() => setStep("result")}
                disabled={!hasValidRoll}
              >
                Continue
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="retro-box-title">
              {succeeded ? "Stabilized" : "Failed to stabilize"}
            </p>
            {usedKit ? (
              <p className="retro-muted">
                You use a healer&apos;s kit to stabilize <strong>{targetLabel}</strong>.
              </p>
            ) : total != null ? (
              <p className="retro-muted">
                Medicine check: {rollValue} {formatModifier(medicineMod)} = {total}{" "}
                vs DC {STABILIZE_MEDICINE_DC} —{" "}
                {succeeded ? "success" : "failure"}
              </p>
            ) : null}
            <div className="supply-picker-actions death-save-roll-actions">
              {succeeded ? (
                <button type="button" className="candy-btn" onClick={confirmStabilize}>
                  Continue
                </button>
              ) : (
                <button type="button" className="candy-btn" onClick={onCancel}>
                  Close
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
