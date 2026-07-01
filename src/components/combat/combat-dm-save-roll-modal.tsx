"use client";

import { useState } from "react";
import { parseD20Roll } from "@/components/combat/combat-roll-fields";
import { CombatSaveRollEntry } from "@/components/combat/combat-save-roll-entry";
import {
  computeEffectiveSaveRollValue,
  getTokenSaveModifier,
} from "@/lib/combat/attack-resolution";
import type { ParsedCharacter } from "@/lib/character/utils";
import type { PhbClass } from "@/lib/dnd/phb/types";
import type { EnemyData } from "@/lib/schemas/enemy";
import type { CombatToken, PendingAttackTarget } from "@/lib/schemas/combat-state";

interface CombatDmSaveRollModalProps {
  targets: PendingAttackTarget[];
  tokens: CombatToken[];
  charactersById: Record<string, ParsedCharacter>;
  enemiesBySlug: Record<string, { data: EnemyData }>;
  classCatalog?: PhbClass[];
  saveAbility?: string;
  saveDc?: number;
  damageType?: string;
  saveHalfDamageOnSuccess?: boolean;
  onCancel: () => void;
  onSubmit: (
    saves: Array<{ tokenId: string; saveRoll: number; saveTotal: number; saveRoll2?: number | null }>
  ) => void;
  submitting?: boolean;
}

export function CombatDmSaveRollModal({
  targets,
  tokens,
  charactersById,
  enemiesBySlug,
  classCatalog,
  saveAbility,
  saveDc,
  damageType,
  saveHalfDamageOnSuccess = true,
  onCancel,
  onSubmit,
  submitting = false,
}: CombatDmSaveRollModalProps) {
  const [rolls, setRolls] = useState<Record<string, string>>({});
  const [rolls2, setRolls2] = useState<Record<string, string>>({});

  function resolveSaveModifier(targetTokenId: string): number | null {
    const token = tokens.find((entry) => entry.id === targetTokenId);
    if (!token) return null;
    const character = token.characterId ? charactersById[token.characterId] ?? null : null;
    const enemyData = token.enemySlug ? enemiesBySlug[token.enemySlug]?.data ?? null : null;
    return getTokenSaveModifier(token, saveAbility, {
      character,
      enemyData,
      classCatalog,
    });
  }

  function handleSubmit() {
    onSubmit(
      targets.map((target) => {
        const saveRollValue = parseD20Roll(rolls[target.tokenId] ?? "");
        const saveRoll2Value = parseD20Roll(rolls2[target.tokenId] ?? "");
        const usedRoll = computeEffectiveSaveRollValue(saveRollValue, saveRoll2Value, {
          saveAdvantage: target.saveAdvantage,
          saveDisadvantage: target.saveDisadvantage,
        }) ?? 0;
        const saveMod = resolveSaveModifier(target.tokenId) ?? 0;
        const saveTotal = usedRoll + saveMod;
        return {
          tokenId: target.tokenId,
          saveRoll: usedRoll,
          saveTotal,
          saveRoll2:
            target.saveAdvantage || target.saveDisadvantage ? saveRoll2Value : null,
        };
      })
    );
  }

  const allSavesValid = targets.every((target) => {
    const saveRollValue = parseD20Roll(rolls[target.tokenId] ?? "");
    const saveRoll2Value = parseD20Roll(rolls2[target.tokenId] ?? "");
    return (
      computeEffectiveSaveRollValue(saveRollValue, saveRoll2Value, {
        saveAdvantage: target.saveAdvantage,
        saveDisadvantage: target.saveDisadvantage,
      }) != null
    );
  });

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-dm-save-roll-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">Enter saving throws</p>
        <div className="combat-battle-tooltip-summary retro-muted combat-awaiting-saves-summary">
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

        <div className="combat-dm-save-roll-list">
          {targets.map((target) => (
            <CombatSaveRollEntry
              key={target.tokenId}
              label={target.label}
              saveRoll={rolls[target.tokenId] ?? ""}
              saveRoll2={rolls2[target.tokenId] ?? ""}
              onSaveRollChange={(value) =>
                setRolls((current) => ({
                  ...current,
                  [target.tokenId]: value,
                }))
              }
              onSaveRoll2Change={(value) =>
                setRolls2((current) => ({
                  ...current,
                  [target.tokenId]: value,
                }))
              }
              saveModifier={resolveSaveModifier(target.tokenId)}
              saveAdvantage={target.saveAdvantage}
              saveDisadvantage={target.saveDisadvantage}
              saveDc={saveDc}
              baseDamage={target.damageAmount ?? null}
              damageType={damageType}
              saveHalfDamageOnSuccess={saveHalfDamageOnSuccess}
              disabled={submitting}
            />
          ))}
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
