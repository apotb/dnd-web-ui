"use client";

import { useEffect, useState } from "react";
import type { DerivedAttack } from "@/lib/dnd/attacks";
import type { CombatToken } from "@/lib/schemas/combat-state";
import {
  areDamageRollsComplete,
  DamageRollField,
  emptyDamageRolls,
  getDamageSubmitValues,
  HitRollField,
  isD20RollComplete,
  parseD20Roll,
} from "@/components/combat/combat-roll-fields";
import { parseDamageNotation } from "@/lib/dnd/dice";

export interface AttackSubmitValues {
  attackRoll?: number | null;
  damageText?: string;
  damageRolls?: number[];
  damageAmount?: number | null;
  perTarget?: Array<{
    tokenId: string;
    attackRoll?: number | null;
    damageText: string;
    damageRolls?: number[];
    damageAmount: number | null;
  }>;
}

interface CombatAttackSubmitModalProps {
  attack: DerivedAttack;
  optionName: string;
  targets: CombatToken[];
  damageTakenByTokenId: Record<string, number>;
  onCancel: () => void;
  onSubmit: (values: AttackSubmitValues) => void;
  submitting?: boolean;
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function CombatAttackSubmitModal({
  attack,
  optionName,
  targets,
  damageTakenByTokenId,
  onCancel,
  onSubmit,
  submitting = false,
}: CombatAttackSubmitModalProps) {
  const rollType = attack.rollType ?? "attack";
  const isSave = rollType === "save";
  const isAuto = rollType === "auto";
  const multiTarget = targets.length > 1 && !isSave;

  const [attackRoll, setAttackRoll] = useState("");
  const [damageRolls, setDamageRolls] = useState<string[]>(() =>
    emptyDamageRolls(attack.damageDice)
  );
  const [damageFallbackTotal, setDamageFallbackTotal] = useState("");
  const [perTargetRolls, setPerTargetRolls] = useState<
    Record<string, { attackRoll: string; damageAmount: string }>
  >({});

  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setDamageRolls(emptyDamageRolls(attack.damageDice));
    setDamageFallbackTotal("");
  }, [attack.damageDice]);

  const hasParsedDamage = parseDamageNotation(attack.damageDice) != null;
  const sharedDamageComplete =
    hasParsedDamage
      ? areDamageRollsComplete(attack.damageDice, damageRolls)
      : parseOptionalInt(damageFallbackTotal) != null;

  const singleTargetReady =
    isSave ||
    (isAuto
      ? sharedDamageComplete
      : isD20RollComplete(attackRoll) && sharedDamageComplete);

  const multiTargetReady =
    sharedDamageComplete &&
    targets.every((target) => {
      const entry = perTargetRolls[target.id] ?? { attackRoll: "", damageAmount: "" };
      return isD20RollComplete(entry.attackRoll);
    });

  const canSubmit = isSave
    ? sharedDamageComplete
    : multiTarget
      ? multiTargetReady
      : singleTargetReady;

  function handleSubmit() {
    setSubmitError(null);

    if (!canSubmit) {
      setSubmitError("Enter valid die rolls for each field (d20: 1–20, damage dice: 1–sides).");
      return;
    }

    const sharedDamage = getDamageSubmitValues(
      attack.damageDice,
      damageRolls,
      damageFallbackTotal
    );

    if (multiTarget) {
      onSubmit({
        perTarget: targets.map((target) => {
          const entry = perTargetRolls[target.id] ?? {
            attackRoll: "",
            damageAmount: "",
          };
          return {
            tokenId: target.id,
            attackRoll: parseD20Roll(entry.attackRoll),
            damageText: sharedDamage.damageText,
            damageRolls: sharedDamage.damageRolls,
            damageAmount: parseOptionalInt(entry.damageAmount) ?? sharedDamage.damageAmount,
          };
        }),
      });
      return;
    }

    onSubmit({
      attackRoll: isSave || isAuto ? null : parseD20Roll(attackRoll),
      ...sharedDamage,
    });
  }

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-attack-submit-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">{optionName}</p>

        <div className="combat-attack-submit-targets">
          {targets.map((target) => (
            <div key={target.id} className="combat-attack-submit-target">
              <strong>{target.label}</strong>
              <span className="retro-muted">
                Battle damage taken: {damageTakenByTokenId[target.id] ?? 0}
              </span>
            </div>
          ))}
        </div>

        {!isSave && !multiTarget ? (
          <div className="combat-attack-submit-fields">
            {!isAuto ? (
              <HitRollField
                value={attackRoll}
                onChange={setAttackRoll}
                attackBonus={attack.attackBonus}
                disabled={submitting}
              />
            ) : (
              <p className="retro-muted">Auto hit — enter damage below.</p>
            )}
            <DamageRollField
              damageDice={attack.damageDice}
              rolls={damageRolls}
              onRollsChange={setDamageRolls}
              fallbackTotal={damageFallbackTotal}
              onFallbackTotalChange={setDamageFallbackTotal}
              disabled={submitting}
            />
          </div>
        ) : null}

        {isSave ? (
          <p className="retro-muted combat-attack-submit-hint">
            Save DC {attack.saveDc}
            {attack.saveAbility ? ` ${attack.saveAbility}` : ""}. Affected creatures will roll
            saves; enter the damage they take on a failed save.
          </p>
        ) : null}

        {isSave || multiTarget ? (
          <div className="combat-attack-submit-fields">
            <DamageRollField
              damageDice={attack.damageDice}
              rolls={damageRolls}
              onRollsChange={setDamageRolls}
              fallbackTotal={damageFallbackTotal}
              onFallbackTotalChange={setDamageFallbackTotal}
              disabled={submitting}
            />
          </div>
        ) : null}

        {multiTarget && !isSave ? (
          <div className="combat-attack-submit-multi">
            {targets.map((target) => {
              const entry = perTargetRolls[target.id] ?? {
                attackRoll: "",
                damageAmount: "",
              };
              return (
                <div key={target.id} className="combat-attack-submit-target-block">
                  <strong>{target.label}</strong>
                  <HitRollField
                    value={entry.attackRoll}
                    onChange={(value) =>
                      setPerTargetRolls((current) => ({
                        ...current,
                        [target.id]: { ...entry, attackRoll: value },
                      }))
                    }
                    attackBonus={attack.attackBonus}
                    disabled={submitting}
                  />
                  <label className="combat-attack-submit-field">
                    <span>Damage total</span>
                    <input
                      type="number"
                      min={0}
                      className="candy-input"
                      placeholder="Leave blank to use shared damage"
                      value={entry.damageAmount}
                      onChange={(event) =>
                        setPerTargetRolls((current) => ({
                          ...current,
                          [target.id]: { ...entry, damageAmount: event.target.value },
                        }))
                      }
                      disabled={submitting}
                    />
                  </label>
                </div>
              );
            })}
          </div>
        ) : null}

        {submitError ? <p className="retro-muted">{submitError}</p> : null}

        <div className="supply-picker-actions combat-roll-actions">
          <button type="button" className="candy-btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <div className="combat-roll-right-actions">
            <button
              type="button"
              className="candy-btn"
              onClick={handleSubmit}
              disabled={submitting || !canSubmit}
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
