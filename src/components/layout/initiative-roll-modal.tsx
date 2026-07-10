"use client";

import { useState } from "react";
import { submitInitiativeRoll } from "@/lib/combat/initiative-actions";
import { CheckRollModeIndicator } from "@/components/character/check-roll-mode-indicator";
import { formatInitiativeTooltip } from "@/lib/character/combat-derivation";
import {
  formatCheckRollModeTooltip,
  getAbilityCheckRollMode,
} from "@/lib/character/check-roll-mode";
import { formatModifier } from "@/lib/dnd/calculations";
import type { CharacterData } from "@/lib/schemas/character";
import { parseD20Roll, sanitizeDieRollInput } from "@/lib/dnd/dice";
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
  const initiativeTooltip = formatInitiativeTooltip(data);
  const initiativeCheckRollMode = getAbilityCheckRollMode(data, "dex");
  const initiativeCheckRollModeTooltip = formatCheckRollModeTooltip(
    initiativeCheckRollMode
  );
  const rollValue = parseD20Roll(roll);
  const hasValidRoll = rollValue != null;
  const rollTotal = hasValidRoll ? rollValue + modifier : null;

  async function submit() {
    const parsedRoll = parseD20Roll(roll);
    if (parsedRoll == null) {
      setMessage("Enter a d20 roll from 1 to 20.");
      return;
    }

    setSaving(true);
    setMessage(null);

    const { error } = await submitInitiativeRoll(campaignId, characterId, parsedRoll);
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
            type="text"
            inputMode="numeric"
            placeholder="d20"
            value={roll}
            onChange={(event) => setRoll(sanitizeDieRollInput(event.target.value, 20))}
            disabled={saving}
            autoFocus
            aria-label="d20 roll"
            aria-invalid={roll.trim().length > 0 && !hasValidRoll}
          />
          {initiativeCheckRollMode.mode && initiativeCheckRollModeTooltip ? (
            <CheckRollModeIndicator
              mode={initiativeCheckRollMode.mode}
              tooltip={initiativeCheckRollModeTooltip}
            />
          ) : null}
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
            disabled={saving || !hasValidRoll}
          >
            {saving ? "..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
