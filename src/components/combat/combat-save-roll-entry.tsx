"use client";

import { parseD20Roll, SaveRollField } from "@/components/combat/combat-roll-fields";
import {
  computeEffectiveSaveRollValue,
  computeSaveSucceeded,
  formatSaveOutcomeLabel,
  previewSaveDamage,
} from "@/lib/combat/attack-resolution";
import { formatModifier } from "@/lib/dnd/calculations";

interface CombatSaveRollEntryProps {
  label: string;
  subtitle?: string;
  saveRoll: string;
  saveRoll2?: string;
  onSaveRollChange: (value: string) => void;
  onSaveRoll2Change?: (value: string) => void;
  saveModifier: number | null;
  saveAdvantage?: boolean;
  saveDisadvantage?: boolean;
  saveDc?: number | null;
  baseDamage?: number | null;
  damageType?: string;
  saveHalfDamageOnSuccess?: boolean;
  disabled?: boolean;
}

export function CombatSaveRollEntry({
  label,
  subtitle,
  saveRoll,
  saveRoll2 = "",
  onSaveRollChange,
  onSaveRoll2Change,
  saveModifier,
  saveAdvantage = false,
  saveDisadvantage = false,
  saveDc,
  baseDamage = null,
  damageType,
  saveHalfDamageOnSuccess = true,
  disabled = false,
}: CombatSaveRollEntryProps) {
  const saveRollValue = parseD20Roll(saveRoll);
  const saveRoll2Value = parseD20Roll(saveRoll2);
  const usedRoll = computeEffectiveSaveRollValue(saveRollValue, saveRoll2Value, {
    saveAdvantage,
    saveDisadvantage,
  });
  const saveTotal =
    usedRoll != null && saveModifier != null ? usedRoll + saveModifier : null;
  const hasValidRoll = usedRoll != null && saveModifier != null && saveTotal != null;
  const saveSucceeded =
    hasValidRoll && saveDc != null ? computeSaveSucceeded(saveTotal, saveDc) : null;
  const previewDamage =
    hasValidRoll && baseDamage != null && saveSucceeded != null
      ? previewSaveDamage(baseDamage, saveSucceeded, saveHalfDamageOnSuccess)
      : null;

  const rollModeLabel = saveAdvantage
    ? "advantage — use higher die"
    : saveDisadvantage
      ? "disadvantage — use lower die"
      : null;

  return (
    <div className="combat-save-roll-entry">
      {label || subtitle ? (
        <div className="combat-save-roll-entry-header">
          {label ? <strong>{label}</strong> : null}
          {subtitle ? <span className="retro-muted">{subtitle}</span> : null}
        </div>
      ) : null}
      {rollModeLabel ? (
        <p className="combat-save-roll-mode retro-muted">{rollModeLabel}</p>
      ) : null}
      <div className="dehydration-save-roll-row combat-save-roll-entry-row">
        <div className="dehydration-save-roll-input combat-save-roll-inputs">
          <SaveRollField value={saveRoll} onChange={onSaveRollChange} disabled={disabled} />
          {saveAdvantage || saveDisadvantage ? (
            <>
              <span className="combat-save-roll-sep">,</span>
              <SaveRollField
                value={saveRoll2}
                onChange={onSaveRoll2Change ?? (() => {})}
                disabled={disabled}
              />
              {usedRoll != null ? (
                <>
                  <span className="combat-save-roll-sep">→</span>
                  <span className="dehydration-save-roll-mod">{usedRoll}</span>
                </>
              ) : null}
            </>
          ) : null}
        </div>
        <span className="dehydration-save-roll-mod">
          {saveModifier != null ? formatModifier(saveModifier) : "—"}
        </span>
        <span className="dehydration-save-roll-total" aria-live="polite">
          = {saveTotal ?? "—"}
        </span>
      </div>
      {hasValidRoll && saveSucceeded != null ? (
        <p
          className={`combat-save-roll-outcome${
            saveSucceeded ? "" : " combat-save-roll-outcome-fail"
          }`}
        >
          {formatSaveOutcomeLabel({
            saveSucceeded,
            damage: previewDamage ?? 0,
            damageType,
            saveHalfDamageOnSuccess,
          })}
        </p>
      ) : null}
    </div>
  );
}
