"use client";

import { useState } from "react";
import { parseD20Roll } from "@/components/combat/combat-roll-fields";
import { CombatSaveRollEntry } from "@/components/combat/combat-save-roll-entry";
import { computeEffectiveSaveRollValue } from "@/lib/combat/attack-resolution";
import type { PendingAttackTarget } from "@/lib/schemas/combat-state";

interface CombatSaveRollModalProps {
  target: PendingAttackTarget;
  saveAbility?: string;
  saveDc?: number;
  saveModifier?: number | null;
  damageType?: string;
  saveHalfDamageOnSuccess?: boolean;
  onCancel: () => void;
  onSubmit: (saveRoll: number, saveTotal: number, saveRoll2?: number | null) => void;
  submitting?: boolean;
}

export function CombatSaveRollModal({
  target,
  saveAbility,
  saveDc,
  saveModifier = null,
  damageType,
  saveHalfDamageOnSuccess = true,
  onCancel,
  onSubmit,
  submitting = false,
}: CombatSaveRollModalProps) {
  const [saveRoll, setSaveRoll] = useState("");
  const [saveRoll2, setSaveRoll2] = useState("");
  const saveRollValue = parseD20Roll(saveRoll);
  const saveRoll2Value = parseD20Roll(saveRoll2);
  const usedRoll = computeEffectiveSaveRollValue(saveRollValue, saveRoll2Value, {
    saveAdvantage: target.saveAdvantage,
    saveDisadvantage: target.saveDisadvantage,
  });
  const saveTotal =
    usedRoll != null && saveModifier != null ? usedRoll + saveModifier : null;
  const canSubmit = usedRoll != null && saveModifier != null;

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-save-roll-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">Saving throw</p>
        <div className="combat-battle-tooltip-summary retro-muted combat-awaiting-saves-summary">
          <p className="combat-battle-tooltip-meta">{target.label}</p>
          <p className="combat-battle-tooltip-meta">
            Save: DC {saveDc ?? "?"}
            {saveAbility ? ` ${saveAbility}` : ""}
          </p>
          <p className="combat-battle-tooltip-meta">
            {saveHalfDamageOnSuccess
              ? "Half damage on a successful save"
              : "No damage on a successful save"}
          </p>
        </div>

        <CombatSaveRollEntry
          label=""
          saveRoll={saveRoll}
          saveRoll2={saveRoll2}
          onSaveRollChange={setSaveRoll}
          onSaveRoll2Change={setSaveRoll2}
          saveModifier={saveModifier}
          saveAdvantage={target.saveAdvantage}
          saveDisadvantage={target.saveDisadvantage}
          saveDc={saveDc}
          baseDamage={target.damageAmount ?? null}
          damageType={damageType}
          saveHalfDamageOnSuccess={saveHalfDamageOnSuccess}
          disabled={submitting}
        />

        <div className="supply-picker-actions combat-roll-actions">
          <button type="button" className="candy-btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <div className="combat-roll-right-actions">
            <button
              type="button"
              className="candy-btn"
              onClick={() => {
                if (usedRoll == null || saveModifier == null || saveTotal == null) return;
                onSubmit(
                  usedRoll,
                  saveTotal,
                  target.saveAdvantage || target.saveDisadvantage ? saveRoll2Value : null
                );
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
