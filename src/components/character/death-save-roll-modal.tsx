"use client";

import { useState } from "react";
import {
  applyDeathSaveRoll,
  interpretDeathSaveRoll,
} from "@/lib/dnd/death-saves";
import { parseD20Roll, sanitizeDieRollInput } from "@/lib/dnd/dice";
import type { CharacterData } from "@/lib/schemas/character";

interface DeathSaveRollModalProps {
  data: CharacterData;
  onCancel: () => void;
  onApply: (combat: CharacterData["combat"]) => void;
}

type Step = "roll" | "result";

export function DeathSaveRollModal({
  data,
  onCancel,
  onApply,
}: DeathSaveRollModalProps) {
  const [step, setStep] = useState<Step>("roll");
  const [rollInput, setRollInput] = useState("");
  const [parsedRoll, setParsedRoll] = useState<number | null>(null);

  const rollValue = parseD20Roll(rollInput);
  const hasValidRoll = rollValue != null;
  const { successes, failures } = data.combat.deathSaves;

  const interpretation =
    parsedRoll != null ? interpretDeathSaveRoll(parsedRoll) : null;
  const preview =
    parsedRoll != null ? applyDeathSaveRoll(data.combat, parsedRoll) : null;

  function goToResult() {
    if (rollValue == null) return;
    setParsedRoll(rollValue);
    setStep("result");
  }

  function apply() {
    if (!preview) return;
    onApply(preview.combat);
  }

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
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
                onClick={goToResult}
                disabled={!hasValidRoll}
              >
                Continue
              </button>
            </div>
          </>
        ) : interpretation && preview ? (
          <>
            <p className="retro-box-title">Death save result</p>
            <p className="retro-muted">
              You rolled <strong>{interpretation.roll}</strong> —{" "}
              {interpretation.summary}
            </p>
            <p className="retro-muted">{interpretation.detail}</p>
            <div className="death-save-roll-preview">
              {preview.regainedConsciousness ? (
                <p>Hit points: 0 → 1</p>
              ) : null}
              <p>
                Successes: {successes}/3 →{" "}
                {preview.combat.deathSaves.successes}/3
              </p>
              <p>
                Failures: {failures}/3 → {preview.combat.deathSaves.failures}/3
              </p>
              {preview.becameStable ? (
                <p className="death-save-roll-outcome death-save-roll-outcome--stable">
                  You become stable (unconscious at 0 HP; no more death saves
                  until you take damage).
                </p>
              ) : null}
              {preview.becameDead ? (
                <p className="death-save-roll-outcome death-save-roll-outcome--dead">
                  Three failures — your character dies.
                </p>
              ) : null}
            </div>
            <div className="supply-picker-actions death-save-roll-actions death-save-roll-actions--single">
              <button type="button" className="candy-btn" onClick={apply}>
                Continue
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
