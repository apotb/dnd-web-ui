"use client";

import { useMemo, useState } from "react";
import {
  DamageAppliedField,
  DamageRollField,
  damageRollsToInputValues,
  DisadvantageHitRollField,
  getDamageSubmitValues,
  HitRollField,
  parseD20Roll,
  SaveRollField,
} from "@/components/combat/combat-roll-fields";
import {
  computeDamageApplied,
  computeHitFromRoll,
  formatDamageAppliedBreakdown,
  resolveFinalDamageApplied,
} from "@/lib/combat/attack-resolution";
import { formatAmmunitionConsumptionLine, formatThrownWeaponConsumptionLine } from "@/lib/dnd/ammunition";
import type { PendingAttack, PendingAttackTarget } from "@/lib/schemas/combat-state";

interface CombatAttackReviewModalProps {
  pending: PendingAttack;
  onCancel: () => void;
  onConfirm: (pending: PendingAttack) => void;
  submitting?: boolean;
}

function cloneTarget(target: PendingAttackTarget): PendingAttackTarget {
  return { ...target };
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatHpLine(target: PendingAttackTarget): string {
  const current = target.currentHp;
  const max = target.maxHp;
  if (current == null && max == null) return "HP —";
  if (max == null) return `HP ${current ?? "—"}`;
  return `HP ${current ?? "—"} / ${max}`;
}

function projectedHp(
  target: PendingAttackTarget,
  rollType: PendingAttack["rollType"],
  overrideText: string,
  damageDice: string
): number | null {
  if (target.currentHp == null) return null;
  const damage = resolveFinalDamageApplied(
    target,
    rollType,
    overrideText,
    parseOptionalInt,
    { damageDice }
  );
  return Math.max(0, target.currentHp - damage);
}

export function CombatAttackReviewModal({
  pending,
  onCancel,
  onConfirm,
  submitting = false,
}: CombatAttackReviewModalProps) {
  const [draft, setDraft] = useState<PendingAttack>(() => ({
    ...pending,
    targets: pending.targets.map(cloneTarget),
  }));
  const [damageRollInputs, setDamageRollInputs] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      pending.targets.map((target) => [
        target.tokenId,
        damageRollsToInputValues(pending.damageDice ?? target.damageText ?? "", target.damageRolls),
      ])
    )
  );
  const [damageOverrides, setDamageOverrides] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      pending.targets.map((target) => {
        const computed = computeDamageApplied(target, pending.rollType, {
          damageDice: pending.damageDice,
        });
        const final = target.finalDamage ?? computed;
        return [target.tokenId, final !== computed ? String(final) : ""];
      })
    )
  );

  const attackBonus = pending.attackBonus ?? 0;
  const damageDice = pending.damageDice ?? "";

  function updateTarget(tokenId: string, patch: Partial<PendingAttackTarget>) {
    setDraft((current) => ({
      ...current,
      targets: current.targets.map((target) =>
        target.tokenId === tokenId ? { ...target, ...patch } : target
      ),
    }));
  }

  function handleAttackRollChange(tokenId: string, value: string) {
    const target = draft.targets.find((entry) => entry.tokenId === tokenId);
    if (!target) return;

    const roll = parseD20Roll(value);
    const roll2 = target.attackRoll2 ?? null;
    if (roll != null && target.ac != null) {
      const hitResult = computeHitFromRoll(roll, attackBonus, target.ac, {
        attackRoll2: roll2,
        disadvantage: target.attackDisadvantage,
      });
      updateTarget(tokenId, {
        attackRoll: roll,
        attackTotal: hitResult.total,
        hit: hitResult.hit,
        critical: hitResult.critical,
      });
      return;
    }

    updateTarget(tokenId, {
      attackRoll: roll,
      attackTotal: roll != null ? roll + attackBonus : null,
    });
  }

  function handleAttackRoll2Change(tokenId: string, value: string) {
    const target = draft.targets.find((entry) => entry.tokenId === tokenId);
    if (!target) return;

    const roll2 = parseD20Roll(value);
    const roll = target.attackRoll ?? null;
    if (roll != null && roll2 != null && target.ac != null) {
      const hitResult = computeHitFromRoll(roll, attackBonus, target.ac, {
        attackRoll2: roll2,
        disadvantage: true,
      });
      updateTarget(tokenId, {
        attackRoll2: roll2,
        attackTotal: hitResult.total,
        hit: hitResult.hit,
        critical: hitResult.critical,
      });
      return;
    }

    updateTarget(tokenId, {
      attackRoll2: roll2,
    });
  }

  function handleDamageRollsChange(tokenId: string, rolls: string[]) {
    setDamageRollInputs((current) => ({ ...current, [tokenId]: rolls }));
    const target = draft.targets.find((entry) => entry.tokenId === tokenId);
    if (!target) return;

    const { damageText, damageRolls, damageAmount } = getDamageSubmitValues(
      damageDice || target.damageText || "",
      rolls,
      target.damageAmount?.toString() ?? ""
    );

    updateTarget(tokenId, {
      damageText,
      damageRolls,
      damageAmount,
    });
  }

  function handleHitChange(tokenId: string, hit: boolean) {
    updateTarget(tokenId, hit ? { hit } : { hit, critical: false });
    if (!hit) {
      setDamageOverrides((current) => ({ ...current, [tokenId]: "" }));
    }
  }

  function handleCriticalChange(tokenId: string, critical: boolean) {
    updateTarget(tokenId, { critical });
    setDamageOverrides((current) => ({ ...current, [tokenId]: "" }));
  }

  function handleConfirm() {
    onConfirm({
      ...draft,
      targets: draft.targets.map((target) => ({
        ...target,
        finalDamage: resolveFinalDamageApplied(
          target,
          pending.rollType,
          damageOverrides[target.tokenId] ?? "",
          parseOptionalInt,
          { damageDice: pending.damageDice }
        ),
      })),
    });
  }

  const targetSections = useMemo(
    () =>
      draft.targets.map((target) => {
        const overrideText = damageOverrides[target.tokenId] ?? "";
        const afterHp = projectedHp(target, pending.rollType, overrideText, damageDice);
        const rolls = damageRollInputs[target.tokenId] ?? [];
        const computedDamage = computeDamageApplied(target, pending.rollType, { damageDice });
        const damageBreakdown = formatDamageAppliedBreakdown(
          target,
          pending.rollType,
          computedDamage,
          { damageDice }
        );

        return (
          <div key={target.tokenId} className="combat-attack-review-target">
            <strong>{target.label}</strong>
            <span className="retro-muted">
              AC {target.ac ?? "?"} · {formatHpLine(target)}
              {target.attackDisadvantage ? " · Long range (disadvantage)" : ""}
              {afterHp != null ? ` · After damage: ${afterHp} HP` : ""}
            </span>

            {pending.rollType === "attack" ? (
              <div className="combat-attack-review-fields">
                {target.attackDisadvantage ? (
                  <DisadvantageHitRollField
                    roll1={target.attackRoll?.toString() ?? ""}
                    roll2={target.attackRoll2?.toString() ?? ""}
                    onRoll1Change={(value) => handleAttackRollChange(target.tokenId, value)}
                    onRoll2Change={(value) => handleAttackRoll2Change(target.tokenId, value)}
                    attackBonus={attackBonus}
                    disabled={submitting}
                  />
                ) : (
                  <HitRollField
                    value={target.attackRoll?.toString() ?? ""}
                    onChange={(value) => handleAttackRollChange(target.tokenId, value)}
                    attackBonus={attackBonus}
                    disabled={submitting}
                  />
                )}
                <label className="combat-attack-submit-field combat-attack-review-check">
                  <input
                    type="checkbox"
                    checked={target.hit ?? false}
                    onChange={(event) => handleHitChange(target.tokenId, event.target.checked)}
                    disabled={submitting}
                  />
                  <span>Hit</span>
                </label>
                <label className="combat-attack-submit-field combat-attack-review-check">
                  <input
                    type="checkbox"
                    checked={target.critical ?? false}
                    onChange={(event) =>
                      handleCriticalChange(target.tokenId, event.target.checked)
                    }
                    disabled={submitting || !target.hit}
                  />
                  <span>Critical</span>
                </label>
              </div>
            ) : null}

            {pending.rollType === "save" ? (
              <div className="combat-attack-review-fields">
                <label className="combat-attack-submit-field">
                  <span>Save roll (d20)</span>
                  <SaveRollField
                    value={target.saveRoll?.toString() ?? ""}
                    onChange={(value) =>
                      updateTarget(target.tokenId, {
                        saveRoll: parseD20Roll(value),
                      })
                    }
                    disabled={submitting}
                  />
                </label>
                <label className="combat-attack-submit-field">
                  <span>Save total</span>
                  <input
                    type="number"
                    className="candy-input"
                    value={target.saveTotal ?? ""}
                    onChange={(event) =>
                      updateTarget(target.tokenId, {
                        saveTotal: parseInt(event.target.value, 10) || null,
                      })
                    }
                    disabled={submitting}
                  />
                </label>
                <label className="combat-attack-submit-field combat-attack-review-check">
                  <input
                    type="checkbox"
                    checked={target.saveSucceeded ?? false}
                    onChange={(event) =>
                      updateTarget(target.tokenId, { saveSucceeded: event.target.checked })
                    }
                    disabled={submitting}
                  />
                  <span>Succeeded</span>
                </label>
              </div>
            ) : null}

            <div className="combat-attack-review-fields">
              <DamageRollField
                damageDice={damageDice || target.damageText || ""}
                rolls={rolls}
                onRollsChange={(nextRolls) => handleDamageRollsChange(target.tokenId, nextRolls)}
                fallbackTotal={target.damageAmount?.toString() ?? ""}
                onFallbackTotalChange={(value) => {
                  updateTarget(target.tokenId, {
                    damageAmount: parseOptionalInt(value),
                  });
                }}
                knownTotal={target.damageAmount}
                disabled={submitting}
              />
              <DamageAppliedField
                computedDamage={computedDamage}
                overrideValue={overrideText}
                breakdown={damageBreakdown}
                onOverrideChange={(value) =>
                  setDamageOverrides((current) => ({
                    ...current,
                    [target.tokenId]: value,
                  }))
                }
                disabled={submitting}
              />
            </div>
          </div>
        );
      }),
    [
      attackBonus,
      damageDice,
      damageOverrides,
      damageRollInputs,
      draft.targets,
      pending.rollType,
      submitting,
    ]
  );

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-attack-review-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">Review attack — {pending.optionName}</p>

        {pending.ammunitionItemName ? (
          <p className="retro-muted combat-attack-submit-ammo">
            {formatAmmunitionConsumptionLine(
              pending.ammunitionItemName,
              pending.ammunitionQuantity ?? 1
            )}
          </p>
        ) : null}
        {pending.thrownItemName ? (
          <p className="retro-muted combat-attack-submit-ammo">
            {formatThrownWeaponConsumptionLine(pending.thrownItemName)}
          </p>
        ) : null}

        <div className="combat-attack-review-targets">{targetSections}</div>

        <div className="supply-picker-actions combat-roll-actions">
          <button type="button" className="candy-btn" onClick={onCancel} disabled={submitting}>
            Reject
          </button>
          <div className="combat-roll-right-actions">
            <button
              type="button"
              className="candy-btn"
              onClick={handleConfirm}
              disabled={submitting}
            >
              {submitting ? "Approving…" : "Approve"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
