"use client";

import { useEffect, useMemo, useState } from "react";
import { CombatBattleTooltipSummary } from "@/components/combat/combat-battle-tooltip-summary";
import type { DerivedAttack } from "@/lib/dnd/attacks";
import {
  battleTooltipFallbackCharacter,
  buildBattleAttackTooltipParts,
} from "@/lib/combat/battle-tooltip";
import { formatAttackDisadvantageLabel } from "@/lib/combat/targeting";
import type { CharacterData } from "@/lib/schemas/character";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import {
  areDamageRollsComplete,
  DamageRollField,
  DisadvantageHitRollField,
  emptyDamageRolls,
  getDamageSubmitValues,
  HitRollField,
  isCriticalHitRollInput,
  isDisadvantageHitRollComplete,
  isD20RollComplete,
  parseD20Roll,
  resolveWeaponGripDamageDice,
  WeaponGripField,
  type WeaponGrip,
} from "@/components/combat/combat-roll-fields";
import { parseDamageNotation } from "@/lib/dnd/dice";
import { findProtectionEligibleTokens, qualifiesForGreatWeaponFighting } from "@/lib/dnd/fighting-styles";
import type { ParsedCharacter } from "@/lib/character/utils";
import type { Item } from "@/lib/schemas/item";
import type { PhbClass } from "@/lib/dnd/phb/types";

export interface AttackSubmitValues {
  attackRoll?: number | null;
  attackRoll2?: number | null;
  damageText?: string;
  damageRolls?: number[];
  damageAmount?: number | null;
  damageDice?: string;
  weaponGrip?: WeaponGrip;
  protectionByTargetId?: Record<string, string>;
  perTarget?: Array<{
    tokenId: string;
    attackRoll?: number | null;
    attackRoll2?: number | null;
    damageText: string;
    damageRolls?: number[];
    damageAmount: number | null;
  }>;
}

interface CombatAttackSubmitModalProps {
  attack: DerivedAttack;
  optionName: string;
  targets: CombatToken[];
  attackerToken?: CombatToken;
  attackerCharacter?: CharacterData;
  combatState?: CombatState;
  attackDisadvantageByTokenId?: Record<string, boolean>;
  charactersById?: Record<string, ParsedCharacter>;
  catalogItems?: Record<string, Item>;
  classCatalog?: PhbClass[];
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
  attackerToken,
  attackerCharacter,
  combatState,
  attackDisadvantageByTokenId = {},
  charactersById = {},
  catalogItems = {},
  classCatalog = [],
  damageTakenByTokenId,
  onCancel,
  onSubmit,
  submitting = false,
}: CombatAttackSubmitModalProps) {
  const rollType = attack.rollType ?? "attack";
  const isSave = rollType === "save";
  const isAuto = rollType === "auto";
  const multiTarget = targets.length > 1 && !isSave;
  const attackTooltipParts = useMemo(
    () =>
      buildBattleAttackTooltipParts(
        attack,
        attackerCharacter ?? battleTooltipFallbackCharacter,
        { omitBonusActionNote: true }
      ),
    [attack, attackerCharacter]
  );

  const protectionOptionsByTarget = useMemo(() => {
    if (!attackerToken || !combatState) return {};
    const map: Record<string, CombatToken[]> = {};
    for (const target of targets) {
      map[target.id] = findProtectionEligibleTokens(
        target,
        attackerToken,
        combatState,
        charactersById,
        catalogItems,
        classCatalog
      );
    }
    return map;
  }, [
    attackerToken,
    charactersById,
    catalogItems,
    classCatalog,
    combatState,
    targets,
  ]);

  function hasTargetDisadvantage(targetId: string): boolean {
    return (
      attackDisadvantageByTokenId[targetId] === true ||
      Boolean(protectionByTargetId[targetId])
    );
  }

  function disadvantageLabelForTarget(target: CombatToken): string | null {
    if (!attackDisadvantageByTokenId[target.id]) return null;
    if (attackerToken && combatState) {
      return (
        formatAttackDisadvantageLabel(attackerToken, target, combatState, attack) ??
        "Disadvantage on attack roll"
      );
    }
    return "Disadvantage on attack roll";
  }

  const [attackRoll, setAttackRoll] = useState("");
  const [attackRoll2, setAttackRoll2] = useState("");
  const [weaponGrip, setWeaponGrip] = useState<WeaponGrip>("one-handed");
  const [damageRolls, setDamageRolls] = useState<string[]>(() =>
    emptyDamageRolls(attack.damageDice)
  );
  const [damageFallbackTotal, setDamageFallbackTotal] = useState("");
  const [perTargetRolls, setPerTargetRolls] = useState<
    Record<string, { attackRoll: string; attackRoll2: string; damageAmount: string }>
  >({});

  const [protectionByTargetId, setProtectionByTargetId] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const greatWeaponFighting = useMemo(() => {
    if (!attackerCharacter || attack.source !== "weapon") return false;
    return qualifiesForGreatWeaponFighting(
      attackerCharacter,
      catalogItems,
      attack,
      weaponGrip,
      classCatalog
    );
  }, [attackerCharacter, attack, catalogItems, classCatalog, weaponGrip]);

  const singleTargetDisadvantage =
    targets.length === 1
      ? attackDisadvantageByTokenId[targets[0].id] === true ||
        Boolean(protectionByTargetId[targets[0].id])
      : false;

  const effectiveDamageDice = useMemo(
    () => resolveWeaponGripDamageDice(attack, weaponGrip),
    [attack, weaponGrip]
  );

  const isCriticalHit = useMemo(() => {
    if (isSave || isAuto || multiTarget) return false;
    if (singleTargetDisadvantage) {
      return isCriticalHitRollInput(attackRoll, {
        roll2: attackRoll2,
        disadvantage: true,
      });
    }
    return isCriticalHitRollInput(attackRoll);
  }, [
    attackRoll,
    attackRoll2,
    isAuto,
    isSave,
    multiTarget,
    singleTargetDisadvantage,
  ]);

  useEffect(() => {
    setWeaponGrip("one-handed");
    setProtectionByTargetId({});
  }, [attack.id]);

  useEffect(() => {
    setDamageRolls(emptyDamageRolls(effectiveDamageDice));
    setDamageFallbackTotal("");
  }, [effectiveDamageDice]);

  const hasParsedDamage = parseDamageNotation(effectiveDamageDice) != null;
  const sharedDamageComplete =
    hasParsedDamage
      ? areDamageRollsComplete(effectiveDamageDice, damageRolls)
      : parseOptionalInt(damageFallbackTotal) != null;

  const singleTargetReady =
    isSave ||
    (isAuto
      ? sharedDamageComplete
      : singleTargetDisadvantage
        ? isDisadvantageHitRollComplete(attackRoll, attackRoll2) && sharedDamageComplete
        : isD20RollComplete(attackRoll) && sharedDamageComplete);

  const multiTargetReady =
    sharedDamageComplete &&
    targets.every((target) => {
      const entry = perTargetRolls[target.id] ?? {
        attackRoll: "",
        attackRoll2: "",
        damageAmount: "",
      };
      if (hasTargetDisadvantage(target.id)) {
        return isDisadvantageHitRollComplete(entry.attackRoll, entry.attackRoll2);
      }
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
      effectiveDamageDice,
      damageRolls,
      damageFallbackTotal,
      { greatWeaponFighting }
    );

    const activeProtection = Object.fromEntries(
      Object.entries(protectionByTargetId).filter(([, protectorId]) => protectorId)
    );

    if (multiTarget) {
      onSubmit({
        damageDice: effectiveDamageDice,
        weaponGrip,
        protectionByTargetId: activeProtection,
        perTarget: targets.map((target) => {
          const entry = perTargetRolls[target.id] ?? {
            attackRoll: "",
            attackRoll2: "",
            damageAmount: "",
          };
          const disadvantage = hasTargetDisadvantage(target.id);
          return {
            tokenId: target.id,
            attackRoll: parseD20Roll(entry.attackRoll),
            attackRoll2: disadvantage ? parseD20Roll(entry.attackRoll2) : null,
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
      attackRoll2:
        isSave || isAuto || !singleTargetDisadvantage ? null : parseD20Roll(attackRoll2),
      damageDice: effectiveDamageDice,
      weaponGrip,
      protectionByTargetId: activeProtection,
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

        <CombatBattleTooltipSummary
          parts={attackTooltipParts}
          omitTitle
          className="retro-muted"
        />

        <div className="combat-attack-submit-targets">
          {targets.map((target) => {
            const protectors = protectionOptionsByTarget[target.id] ?? [];
            const protectionActive = Boolean(protectionByTargetId[target.id]);
            return (
              <div key={target.id} className="combat-attack-submit-target">
                <strong>{target.label}</strong>
                {hasTargetDisadvantage(target.id) ? (
                  <span className="retro-muted">
                    {protectionActive
                      ? "Disadvantage (Protection)"
                      : disadvantageLabelForTarget(target) ?? "Disadvantage on attack roll"}
                  </span>
                ) : null}
                {protectors.length > 0 ? (
                  <label className="combat-protection-picker retro-muted">
                    <span>Protection reaction</span>
                    <select
                      value={protectionByTargetId[target.id] ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        setProtectionByTargetId((current) => {
                          const next = { ...current };
                          if (!value) {
                            delete next[target.id];
                          } else {
                            next[target.id] = value;
                          }
                          return next;
                        });
                      }}
                      disabled={submitting}
                    >
                      <option value="">None</option>
                      {protectors.map((protector) => (
                        <option key={protector.id} value={protector.id}>
                          {protector.label || protector.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <span className="retro-muted">
                  Battle damage taken: {damageTakenByTokenId[target.id] ?? 0}
                </span>
              </div>
            );
          })}
        </div>

        {!isSave && !multiTarget ? (
          <div className="combat-attack-submit-fields">
            {!isAuto ? (
              singleTargetDisadvantage ? (
                <DisadvantageHitRollField
                  roll1={attackRoll}
                  roll2={attackRoll2}
                  onRoll1Change={setAttackRoll}
                  onRoll2Change={setAttackRoll2}
                  attackBonus={attack.attackBonus}
                  disabled={submitting}
                />
              ) : (
                <HitRollField
                  value={attackRoll}
                  onChange={setAttackRoll}
                  attackBonus={attack.attackBonus}
                  disabled={submitting}
                />
              )
            ) : (
              <p className="retro-muted">Auto hit — enter damage below.</p>
            )}
            <WeaponGripField
              attack={attack}
              value={weaponGrip}
              onChange={setWeaponGrip}
              disabled={submitting}
            />
            <DamageRollField
              damageDice={effectiveDamageDice}
              rolls={damageRolls}
              onRollsChange={setDamageRolls}
              fallbackTotal={damageFallbackTotal}
              onFallbackTotalChange={setDamageFallbackTotal}
              critical={isCriticalHit}
              disabled={submitting}
            />
            {greatWeaponFighting ? (
              <p className="retro-muted combat-attack-submit-hint">
                Great Weapon Fighting: damage dice showing 1 or 2 are rerolled on submit.
              </p>
            ) : null}
          </div>
        ) : null}

        {isSave ? (
          <div className="retro-muted combat-attack-submit-hint">
            <p>Affected creatures will roll saves.</p>
            <p>Enter the damage they take on a failed save.</p>
          </div>
        ) : null}

        {isSave || multiTarget ? (
          <div className="combat-attack-submit-fields">
            <WeaponGripField
              attack={attack}
              value={weaponGrip}
              onChange={setWeaponGrip}
              disabled={submitting}
            />
            <DamageRollField
              damageDice={effectiveDamageDice}
              rolls={damageRolls}
              onRollsChange={setDamageRolls}
              fallbackTotal={damageFallbackTotal}
              onFallbackTotalChange={setDamageFallbackTotal}
              critical={isCriticalHit}
              disabled={submitting}
            />
          </div>
        ) : null}

        {multiTarget && !isSave ? (
          <div className="combat-attack-submit-multi">
            {targets.map((target) => {
              const entry = perTargetRolls[target.id] ?? {
                attackRoll: "",
                attackRoll2: "",
                damageAmount: "",
              };
              const disadvantage = hasTargetDisadvantage(target.id);
              return (
                <div key={target.id} className="combat-attack-submit-target-block">
                  <strong>{target.label}</strong>
                  {disadvantage ? (
                    <DisadvantageHitRollField
                      roll1={entry.attackRoll}
                      roll2={entry.attackRoll2}
                      onRoll1Change={(value) =>
                        setPerTargetRolls((current) => ({
                          ...current,
                          [target.id]: { ...entry, attackRoll: value },
                        }))
                      }
                      onRoll2Change={(value) =>
                        setPerTargetRolls((current) => ({
                          ...current,
                          [target.id]: { ...entry, attackRoll2: value },
                        }))
                      }
                      attackBonus={attack.attackBonus}
                      disabled={submitting}
                    />
                  ) : (
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
                  )}
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
