"use client";

import { useState } from "react";
import { submitInitiativeRoll } from "@/lib/combat/initiative-actions";
import { formatInitiativeTooltip } from "@/lib/character/combat-derivation";
import { formatModifier } from "@/lib/dnd/calculations";
import {
  appendExhaustionSheetNote,
  getExhaustionAbilityCheckSheetNote,
} from "@/lib/dnd/exhaustion";
import type { CharacterData } from "@/lib/schemas/character";
import { Tooltip } from "@/components/ui/tooltip";

interface InitiativeRollModalProps {
  campaignId: string;
  characterId: string;
  data: CharacterData;
  onComplete: () => void;
}

export function InitiativeRollModal({
  campaignId,
  characterId,
  data,
  onComplete,
}: InitiativeRollModalProps) {
  const pending = data.combat.pendingInitiativeRoll;
  const [roll, setRoll] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!pending) return null;

  const modifier = pending.modifier;
  const initiativeTooltip = appendExhaustionSheetNote(
    formatInitiativeTooltip(data),
    getExhaustionAbilityCheckSheetNote(data)
  );
  const rollValue = parseInt(roll, 10);
  const hasValidRoll =
    Number.isFinite(rollValue) && rollValue >= 1 && rollValue <= 20;
  const rollTotal = hasValidRoll ? rollValue + modifier : null;

  async function submit() {
    const rollValue = parseInt(roll, 10);
    if (!Number.isFinite(rollValue) || rollValue < 1 || rollValue > 20) {
      setMessage("Enter a d20 roll from 1 to 20.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const { error } = await submitInitiativeRoll(campaignId, characterId, rollValue);
    setSaving(false);

    if (error) {
      setMessage(error);
      return;
    }

    onComplete();
  }

  return (
    <div className="supply-picker-overlay">
      <div className="supply-picker-modal retro-box initiative-roll-modal">
        <p className="retro-box-title">Roll for initiative</p>
        <div className="initiative-roll-row">
          <input
            id="initiative-roll"
            className="candy-input initiative-roll-input"
            type="number"
            min={1}
            max={20}
            placeholder="d20"
            value={roll}
            onChange={(event) => setRoll(event.target.value)}
            disabled={saving}
            autoFocus
            aria-label="d20 roll"
          />
          <Tooltip content={initiativeTooltip}>
            <span className="initiative-roll-mod">{formatModifier(modifier)}</span>
          </Tooltip>
          <span className="initiative-roll-total" aria-live="polite">
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
            {saving ? "..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
