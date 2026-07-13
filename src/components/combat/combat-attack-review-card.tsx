"use client";

import { useMemo, useState } from "react";
import {
  AdvantageHitRollField,
  DamageAppliedField,
  DamageRollField,
  damageRollsToInputValues,
  DisadvantageHitRollField,
  getDamageSubmitValues,
  HitRollField,
  parseD20Roll,
  SaveRollField,
} from "@/components/combat/combat-roll-fields";
import { CombatSaveRollEntry } from "@/components/combat/combat-save-roll-entry";
import { CombatPendingSpellDetails } from "@/components/combat/combat-pending-spell-details";
import {
  computeDamageApplied,
  computeHitFromRoll,
  formatDamageAppliedBreakdown,
  getTargetAttackRollMode,
  resolveFinalDamageApplied,
} from "@/lib/combat/attack-resolution";
import { getDmSaveTargets } from "@/lib/combat/pending-attack-builder";
import { formatAmmunitionConsumptionLine, formatThrownWeaponLine } from "@/lib/dnd/ammunition";
import type { PendingAttack, PendingAttackTarget } from "@/lib/schemas/combat-state";

interface CombatAttackReviewCardProps {
  pending: PendingAttack;
  attackerLabel: string;
  resolveDisadvantageLabel?: (targetTokenId: string) => string | null;
  resolveAdvantageLabel?: (targetTokenId: string) => string | null;
  resolveSaveModifier?: (targetTokenId: string) => number | null;
  onReject: () => void;
  onConfirm: (pending: PendingAttack) => void;
  onSubmitDmSaves?: (
    saves: Array<{ tokenId: string; saveRoll: number; saveTotal: number }>
  ) => void;
  submitting?: boolean;
  submittingSaves?: boolean;
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
  damageDice: string,
  damageOptions?: { saveHalfDamageOnSuccess?: boolean }
): number | null {
  if (target.currentHp == null) return null;
  const damage = resolveFinalDamageApplied(
    target,
    rollType,
    overrideText,
    parseOptionalInt,
    { damageDice, ...damageOptions }
  );
  return Math.max(0, target.currentHp - damage);
}

export function CombatAttackReviewCard({
  pending,
  attackerLabel,
  resolveDisadvantageLabel,
  resolveAdvantageLabel,
  resolveSaveModifier,
  onReject,
  onConfirm,
  onSubmitDmSaves,
  submitting = false,
  submittingSaves = false,
}: CombatAttackReviewCardProps) {
  const isAwaitingSaves = pending.status === "awaiting-saves";
  const dmSaveTargets = useMemo(() => getDmSaveTargets(pending), [pending]);

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
          saveHalfDamageOnSuccess: pending.saveHalfDamageOnSuccess,
        });
        const final = target.finalDamage ?? computed;
        return [target.tokenId, final !== computed ? String(final) : ""];
      })
    )
  );
  const [dmSaveRolls, setDmSaveRolls] = useState<Record<string, string>>({});

  const attackBonus = pending.attackBonus ?? 0;
  const damageDice = pending.damageDice ?? "";
  const busy = submitting || submittingSaves;

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
    const rollMode = getTargetAttackRollMode(target);
    if (roll != null && target.ac != null) {
      const hitResult = computeHitFromRoll(roll, attackBonus, target.ac, {
        attackRoll2: roll2,
        rollMode,
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
    const rollMode = getTargetAttackRollMode(target);
    if (roll != null && roll2 != null && target.ac != null) {
      const hitResult = computeHitFromRoll(roll, attackBonus, target.ac, {
        attackRoll2: roll2,
        rollMode,
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
          {
            damageDice: pending.damageDice,
            saveHalfDamageOnSuccess: pending.saveHalfDamageOnSuccess,
          }
        ),
      })),
    });
  }

  function handleSubmitDmSaves() {
    if (!onSubmitDmSaves) return;
    onSubmitDmSaves(
      dmSaveTargets.map((target) => {
        const saveRoll = parseD20Roll(dmSaveRolls[target.tokenId] ?? "") ?? 0;
        const saveMod = resolveSaveModifier?.(target.tokenId) ?? 0;
        const saveTotal = saveRoll + saveMod;
        return { tokenId: target.tokenId, saveRoll, saveTotal };
      })
    );
  }

  const allDmSavesValid = dmSaveTargets.every((target) => {
    return parseD20Roll(dmSaveRolls[target.tokenId] ?? "") != null;
  });

  const saveHalfDamageOnSuccess = pending.saveHalfDamageOnSuccess ?? true;

  const targetSections = useMemo(
    () =>
      draft.targets.map((target) => {
        const overrideText = damageOverrides[target.tokenId] ?? "";
        const afterHp = projectedHp(target, pending.rollType, overrideText, damageDice, {
          saveHalfDamageOnSuccess,
        });
        const rolls = damageRollInputs[target.tokenId] ?? [];
        const computedDamage = computeDamageApplied(target, pending.rollType, {
          damageDice,
          saveHalfDamageOnSuccess: pending.saveHalfDamageOnSuccess,
        });
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
              {target.attackAdvantage
                ? ` · ${resolveAdvantageLabel?.(target.tokenId) ?? "Advantage on attack roll"}`
                : ""}
              {target.attackDisadvantage
                ? ` · ${resolveDisadvantageLabel?.(target.tokenId) ?? "Disadvantage on attack roll"}`
                : ""}
              {afterHp != null ? ` · After damage: ${afterHp} HP` : ""}
            </span>

            {pending.rollType === "attack" && !isAwaitingSaves ? (
              <div className="combat-attack-review-fields">
                {getTargetAttackRollMode(target) === "disadvantage" ? (
                  <DisadvantageHitRollField
                    roll1={target.attackRoll?.toString() ?? ""}
                    roll2={target.attackRoll2?.toString() ?? ""}
                    onRoll1Change={(value) => handleAttackRollChange(target.tokenId, value)}
                    onRoll2Change={(value) => handleAttackRoll2Change(target.tokenId, value)}
                    attackBonus={attackBonus}
                    disabled={busy}
                  />
                ) : getTargetAttackRollMode(target) === "advantage" ? (
                  <AdvantageHitRollField
                    roll1={target.attackRoll?.toString() ?? ""}
                    roll2={target.attackRoll2?.toString() ?? ""}
                    onRoll1Change={(value) => handleAttackRollChange(target.tokenId, value)}
                    onRoll2Change={(value) => handleAttackRoll2Change(target.tokenId, value)}
                    attackBonus={attackBonus}
                    disabled={busy}
                  />
                ) : (
                  <HitRollField
                    value={target.attackRoll?.toString() ?? ""}
                    onChange={(value) => handleAttackRollChange(target.tokenId, value)}
                    attackBonus={attackBonus}
                    disabled={busy}
                  />
                )}
                <label className="combat-attack-submit-field combat-attack-review-check">
                  <input
                    type="checkbox"
                    checked={target.hit ?? false}
                    onChange={(event) => handleHitChange(target.tokenId, event.target.checked)}
                    disabled={busy}
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
                    disabled={busy || !target.hit}
                  />
                  <span>Critical</span>
                </label>
              </div>
            ) : null}

            {pending.rollType === "save" && !isAwaitingSaves ? (
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
                    disabled={busy}
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
                    disabled={busy}
                  />
                </label>
                <label className="combat-attack-submit-field combat-attack-review-check">
                  <input
                    type="checkbox"
                    checked={target.saveSucceeded ?? false}
                    onChange={(event) =>
                      updateTarget(target.tokenId, { saveSucceeded: event.target.checked })
                    }
                    disabled={busy}
                  />
                  <span>Succeeded</span>
                </label>
              </div>
            ) : null}

            {!isAwaitingSaves ? (
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
                  critical={pending.rollType === "attack" && (target.critical ?? false)}
                  disabled={busy}
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
                  disabled={busy}
                />
              </div>
            ) : null}
          </div>
        );
      }),
    [
      attackBonus,
      busy,
      damageDice,
      damageOverrides,
      damageRollInputs,
      draft.targets,
      isAwaitingSaves,
      pending.rollType,
    ]
  );

  const statusLabel = isAwaitingSaves
    ? dmSaveTargets.length > 0
      ? "Awaiting saves"
      : "Waiting for player saves"
    : pending.spellDetails?.isDeclarationOnly
      ? "Declared spell cast"
      : "Ready to approve";

  const isDeclaredSpellOnly =
    pending.spellDetails?.isDeclarationOnly && pending.targets.length === 0;

  return (
    <article className="combat-attack-review-card retro-box">
      <div className="combat-attack-review-card-header">
        <p className="retro-box-title">{pending.optionName}</p>
        <span className="retro-muted">
          {attackerLabel}
          {pending.isOpportunityAttack ? " · Opportunity attack" : ""}
        </span>
        <span className={`combat-attack-review-status combat-attack-review-status-${pending.status}`}>
          {statusLabel}
        </span>
        {pending.ammunitionItemName ? (
          <span className="retro-muted">
            {formatAmmunitionConsumptionLine(
              pending.ammunitionItemName,
              pending.ammunitionQuantity ?? 1
            )}
          </span>
        ) : null}
        {pending.thrownItemName ? (
          <span className="retro-muted">
            {formatThrownWeaponLine(
              pending.thrownItemName,
              pending.thrownRemaining ?? 1
            )}
          </span>
        ) : null}
      </div>

      {pending.spellDetails ? (
        <CombatPendingSpellDetails details={pending.spellDetails} />
      ) : null}

      {isAwaitingSaves && dmSaveTargets.length > 0 ? (
        <div className="combat-awaiting-saves-panel">
          <p className="combat-awaiting-saves-summary retro-muted">
            DC {pending.saveDc ?? "?"}
            {pending.saveAbility ? ` ${pending.saveAbility}` : ""} save
            {damageDice || pending.damageType
              ? ` · ${[damageDice, pending.damageType].filter(Boolean).join(" ")}`
              : ""}
            {saveHalfDamageOnSuccess
              ? " · half damage on a successful save"
              : " · no damage on a successful save"}
          </p>
          <div className="combat-dm-save-roll-list">
            {dmSaveTargets.map((target) => {
              const saveRoll = dmSaveRolls[target.tokenId] ?? "";
              const saveMod = resolveSaveModifier?.(target.tokenId) ?? null;
              return (
                <CombatSaveRollEntry
                  key={target.tokenId}
                  label={target.label}
                  subtitle={formatHpLine(target)}
                  saveRoll={saveRoll}
                  onSaveRollChange={(value) =>
                    setDmSaveRolls((current) => ({
                      ...current,
                      [target.tokenId]: value,
                    }))
                  }
                  saveModifier={saveMod}
                  saveDc={pending.saveDc}
                  baseDamage={target.damageAmount ?? null}
                  damageType={pending.damageType}
                  saveHalfDamageOnSuccess={saveHalfDamageOnSuccess}
                  disabled={busy}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {!(isAwaitingSaves && dmSaveTargets.length > 0) && !isDeclaredSpellOnly ? (
        <div className="combat-attack-review-targets">{targetSections}</div>
      ) : null}

      <div className="supply-picker-actions combat-roll-actions combat-attack-review-card-actions">
        <button type="button" className="candy-btn" onClick={onReject} disabled={busy}>
          Reject
        </button>
        <div className="combat-roll-right-actions">
          {isAwaitingSaves && dmSaveTargets.length > 0 ? (
            <button
              type="button"
              className="candy-btn"
              onClick={handleSubmitDmSaves}
              disabled={busy || !allDmSavesValid}
            >
              {submittingSaves ? "Submitting…" : "Submit saves"}
            </button>
          ) : !isAwaitingSaves ? (
            <button
              type="button"
              className="candy-btn"
              onClick={handleConfirm}
              disabled={busy}
            >
              {submitting ? "Approving…" : "Approve"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
