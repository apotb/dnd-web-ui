"use client";

import { useState } from "react";
import { saveCharacterData } from "@/lib/character/save-character-data";
import { getConModifier, getDehydrationSaveFailureExhaustionLevels, resolveDehydrationSave } from "@/lib/dnd/survival";
import { formatModifier } from "@/lib/dnd/calculations";
import type { CharacterData } from "@/lib/schemas/character";

interface DehydrationSaveModalProps {
  characterId: string;
  data: CharacterData;
  originalData: CharacterData;
  onComplete: () => void;
}

export function DehydrationSaveModal({
  characterId,
  data,
  originalData,
  onComplete,
}: DehydrationSaveModalProps) {
  const pending = data.supplies.pendingDehydrationSave;
  const [roll, setRoll] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<
    { outcome: "pass" } | { outcome: "fail"; exhaustionGained: number } | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);

  if (result) {
    return (
      <div className="supply-picker-overlay">
        <div className="supply-picker-modal retro-box dehydration-save-modal">
          <p className="retro-box-title">Dehydration save</p>
          <p className="retro-muted">
            {result.outcome === "pass"
              ? "No exhaustion from dehydration."
              : `Gained ${result.exhaustionGained} exhaustion from dehydration.`}
          </p>
          <div className="supply-picker-actions">
            <button type="button" className="candy-btn" onClick={onComplete}>
              OK
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!pending) return null;

  const conMod = getConModifier(data);
  const dc = pending.dc;
  const rollValue = parseInt(roll, 10);
  const hasValidRoll =
    Number.isFinite(rollValue) && rollValue >= 1 && rollValue <= 20;
  const rollTotal = hasValidRoll ? rollValue + conMod : null;

  async function submit() {
    const rollValue = parseInt(roll, 10);
    if (!Number.isFinite(rollValue) || rollValue < 1 || rollValue > 20) {
      setMessage("Enter a d20 roll (1–20).");
      return;
    }

    setSaving(true);
    setMessage(null);
    const total = rollValue + conMod;
    const passed = total >= dc;
    setResult(
      passed
        ? { outcome: "pass" }
        : {
            outcome: "fail",
            exhaustionGained: getDehydrationSaveFailureExhaustionLevels(data),
          }
    );
    const nextData = resolveDehydrationSave(data, total);

    const { error } = await saveCharacterData(
      characterId,
      nextData,
      undefined,
      { isDm: false, originalData }
    );

    setSaving(false);
    if (error) {
      setResult(null);
      setMessage(error);
      return;
    }
  }

  return (
    <div className="supply-picker-overlay">
      <div className="supply-picker-modal retro-box dehydration-save-modal">
        <p className="retro-box-title">Dehydration save</p>
        <p className="retro-muted">
          You drank some water today, but not enough. Make a Constitution saving
          throw.
        </p>
          <div className="dehydration-save-roll-row">
            <input
              id="dehydration-save-roll"
              className="candy-input dehydration-save-roll-input"
              type="number"
              min={1}
              max={20}
              placeholder="d20"
              value={roll}
              onChange={(e) => setRoll(e.target.value)}
              disabled={saving}
              autoFocus
              aria-label="d20 roll"
            />
            <span className="dehydration-save-roll-mod">
              {formatModifier(conMod)}
            </span>
            <span className="dehydration-save-roll-total" aria-live="polite">
              = {rollTotal ?? "—"}
            </span>
          </div>
        {message ? <p className="retro-muted">{message}</p> : null}
        <div className="supply-picker-actions">
          <button
            type="button"
            className="candy-btn"
            onClick={submit}
            disabled={saving || !roll}
          >
            {saving ? "..." : "Roll"}
          </button>
        </div>
      </div>
    </div>
  );
}
