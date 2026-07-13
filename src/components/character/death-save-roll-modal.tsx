"use client";

import { useState } from "react";
import {
  applyDeathSaveRoll,
  interpretDeathSaveRoll,
  type DeathSaveApplyResult,
} from "@/lib/dnd/death-saves";
import { parseD20Roll, sanitizeDieRollInput } from "@/lib/dnd/dice";
import type { CharacterData } from "@/lib/schemas/character";

interface DeathSaveRollModalProps {
  data: CharacterData;
  onCancel: () => void;
  onApply: (
    combat: CharacterData["combat"]
  ) => void | boolean | Promise<void | boolean>;
  onClose?: () => void;
}

type Step = "roll" | "result";

export function DeathSaveRollModal({
  data,
  onCancel,
  onApply,
  onClose,
}: DeathSaveRollModalProps) {
  const [step, setStep] = useState<Step>("roll");
  const [rollInput, setRollInput] = useState("");
  const [applying, setApplying] = useState(false);
  const [appliedRoll, setAppliedRoll] = useState<number | null>(null);
  const [appliedResult, setAppliedResult] = useState<DeathSaveApplyResult | null>(
    null
  );
  const [beforeSaves, setBeforeSaves] = useState<{
    successes: number;
    failures: number;
  } | null>(null);

  const rollValue = parseD20Roll(rollInput);
  const hasValidRoll = rollValue != null;
  const { successes, failures } = data.combat.deathSaves;
  const close = onClose ?? onCancel;

  const interpretation =
    appliedRoll != null ? interpretDeathSaveRoll(appliedRoll) : null;

  async function goToResult() {
    if (rollValue == null || applying) return;

    const result = applyDeathSaveRoll(data.combat, rollValue);
    setApplying(true);
    try {
      const outcome = await onApply(result.combat);
      if (outcome === false) return;

      setBeforeSaves({ successes, failures });
      setAppliedRoll(rollValue);
      setAppliedResult(result);
      setStep("result");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div
      className="supply-picker-overlay"
      onClick={step === "roll" ? onCancel : close}
    >
      <div
        className="supply-picker-modal retro-box death-save-roll-modal"
        onClick={(event) => event.stopPropagation()}
      >
        {step === "roll" ? (
          <>
            <p className="retro-box-title">Death saving throw</p>
            <p className="retro-muted death-save-roll-lead">
              At 0 hit points, roll a d20 at the start of your turn. No ability
              modifiers apply.
            </p>
            <ul className="death-save-roll-rules retro-muted">
              <li>10 or higher: 1 success</li>
              <li>9 or lower: 1 failure</li>
              <li>Natural 20: regain 1 HP and reset saves</li>
              <li>Natural 1: counts as 2 failures</li>
            </ul>
            <p className="retro-muted">
              Current: {successes}/3 successes, {failures}/3 failures
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
                onClick={() => void goToResult()}
                disabled={!hasValidRoll || applying}
              >
                Continue
              </button>
            </div>
          </>
        ) : interpretation && appliedResult && beforeSaves ? (
          <>
            <p className="retro-box-title">Death save result</p>
            <p className="retro-muted">
              You rolled <strong>{interpretation.roll}</strong> —{" "}
              {interpretation.summary}
            </p>
            <p className="retro-muted">{interpretation.detail}</p>
            <div className="death-save-roll-preview">
              {appliedResult.regainedConsciousness ? (
                <p>Hit points: 0 → 1</p>
              ) : null}
              <p>
                Successes: {beforeSaves.successes}/3 →{" "}
                {appliedResult.combat.deathSaves.successes}/3
              </p>
              <p>
                Failures: {beforeSaves.failures}/3 →{" "}
                {appliedResult.combat.deathSaves.failures}/3
              </p>
              {appliedResult.becameStable ? (
                <p className="death-save-roll-outcome death-save-roll-outcome--stable">
                  You become stable (unconscious at 0 HP; no more death saves
                  until you take damage).
                </p>
              ) : null}
              {appliedResult.becameDead ? (
                <p className="death-save-roll-outcome death-save-roll-outcome--dead">
                  Three failures — your character dies.
                </p>
              ) : null}
            </div>
            <div className="supply-picker-actions death-save-roll-actions death-save-roll-actions--single">
              <button type="button" className="candy-btn" onClick={close}>
                Continue
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
