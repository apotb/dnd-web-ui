"use client";

import { useEffect, useMemo, useState } from "react";
import { CombatBattleTooltipSummary } from "@/components/combat/combat-battle-tooltip-summary";
import type { DerivedAttack } from "@/lib/dnd/attacks";
import { canSelectTwoHandedWeaponGrip } from "@/lib/dnd/attacks";
import {
  battleTooltipFallbackCharacter,
  buildBattleAttackTooltipParts,
} from "@/lib/combat/battle-tooltip";
import { formatAttackAdvantageLabel, formatAttackDisadvantageLabel } from "@/lib/combat/targeting";
import { buildTokenStatusContext } from "@/lib/combat/feature-effects";
import { getHelpAttackAdvantageLabel, resolveAttackRollMode, type AttackRollMode } from "@/lib/combat/help";
import { getTokenAc } from "@/lib/combat/attack-resolution";
import { getTokenHpDisplay } from "@/lib/combat/hp-adjust";
import type { CharacterData } from "@/lib/schemas/character";
import type { EnemyData } from "@/lib/schemas/enemy";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import {
  areDamageRollsComplete,
  AdvantageHitRollField,
  DamageRollField,
  DisadvantageHitRollField,
  emptyDamageRolls,
  getDamageSubmitValues,
  HitRollField,
  isCriticalHitRollInput,
  isDualHitRollComplete,
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
  attackAdvantageByTokenId?: Record<string, boolean>;
  charactersById?: Record<string, ParsedCharacter>;
  enemiesBySlug?: Record<string, { data: EnemyData }>;
  catalogItems?: Record<string, Item>;
  classCatalog?: PhbClass[];
  damageTakenByTokenId: Record<string, number>;
  showDmUi?: boolean;
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

function resolveTargetContext(
  token: CombatToken,
  charactersById: Record<string, ParsedCharacter>,
  enemiesBySlug: Record<string, { data: EnemyData }>
) {
  return {
    character: token.characterId ? charactersById[token.characterId] ?? null : null,
    enemyData: token.enemySlug ? enemiesBySlug[token.enemySlug]?.data ?? null : null,
  };
}

function formatTargetStatLine(
  token: CombatToken,
  charactersById: Record<string, ParsedCharacter>,
  enemiesBySlug: Record<string, { data: EnemyData }>,
  damageTakenByTokenId: Record<string, number>,
  showDmUi: boolean
): string {
  const { character, enemyData } = resolveTargetContext(token, charactersById, enemiesBySlug);

  if (token.kind === "party" || token.kind === "ally") {
    const { currentHp, maxHp } = getTokenHpDisplay(token, character, enemyData);
    if (showDmUi) {
      const ac = getTokenAc(token, character, enemyData);
      return `AC ${ac} · HP ${currentHp}/${maxHp}`;
    }
    return `HP ${currentHp}/${maxHp}`;
  }

  if (token.kind === "enemy") {
    const damageTaken = damageTakenByTokenId[token.id] ?? 0;
    if (showDmUi) {
      const ac = getTokenAc(token, character, enemyData);
      return `AC ${ac} · Battle damage taken: ${damageTaken}`;
    }
    return `Battle damage taken: ${damageTaken}`;
  }

  return `Battle damage taken: ${damageTakenByTokenId[token.id] ?? 0}`;
}

export function CombatAttackSubmitModal({
  attack,
  optionName,
  targets,
  attackerToken,
  attackerCharacter,
  combatState,
  attackDisadvantageByTokenId = {},
  attackAdvantageByTokenId = {},
  charactersById = {},
  enemiesBySlug = {},
  catalogItems = {},
  classCatalog = [],
  damageTakenByTokenId,
  showDmUi = false,
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

  const tokenStatusContext = useMemo(
    () => buildTokenStatusContext(Object.values(charactersById)),
    [charactersById]
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

  function getTargetRollMode(targetId: string): AttackRollMode {
    return resolveAttackRollMode(
      attackAdvantageByTokenId[targetId] === true,
      hasTargetDisadvantage(targetId)
    );
  }

  function hasTargetDualRoll(targetId: string): boolean {
    return getTargetRollMode(targetId) != null;
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

  function advantageLabelForTarget(target: CombatToken): string | null {
    if (!attackAdvantageByTokenId[target.id]) return null;
    if (attackerToken && combatState) {
      return (
        getHelpAttackAdvantageLabel(attackerToken, target, combatState) ??
        formatAttackAdvantageLabel(attackerToken, target, attack, tokenStatusContext) ??
        "Advantage on attack roll"
      );
    }
    return "Advantage on attack roll";
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

  const twoHandedGripAllowed = useMemo(
    () => canSelectTwoHandedWeaponGrip(attackerCharacter, catalogItems),
    [attackerCharacter, catalogItems]
  );

  const singleTargetRollMode =
    targets.length === 1 ? getTargetRollMode(targets[0].id) : null;
  const singleTargetDualRoll = singleTargetRollMode != null;

  const effectiveDamageDice = useMemo(
    () => resolveWeaponGripDamageDice(attack, weaponGrip),
    [attack, weaponGrip]
  );

  const isCriticalHit = useMemo(() => {
    if (isSave || isAuto || multiTarget) return false;
    if (singleTargetDualRoll) {
      return isCriticalHitRollInput(attackRoll, {
        roll2: attackRoll2,
        advantage: singleTargetRollMode === "advantage",
        disadvantage: singleTargetRollMode === "disadvantage",
      });
    }
    return isCriticalHitRollInput(attackRoll);
  }, [
    attackRoll,
    attackRoll2,
    isAuto,
    isSave,
    multiTarget,
    singleTargetDualRoll,
    singleTargetRollMode,
  ]);

  useEffect(() => {
    setWeaponGrip("one-handed");
    setProtectionByTargetId({});
  }, [attack.id]);

  useEffect(() => {
    if (!twoHandedGripAllowed && weaponGrip === "two-handed") {
      setWeaponGrip("one-handed");
    }
  }, [twoHandedGripAllowed, weaponGrip]);

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
      : singleTargetDualRoll
        ? isDualHitRollComplete(attackRoll, attackRoll2) && sharedDamageComplete
        : isD20RollComplete(attackRoll) && sharedDamageComplete);

  const multiTargetReady =
    sharedDamageComplete &&
    targets.every((target) => {
      const entry = perTargetRolls[target.id] ?? {
        attackRoll: "",
        attackRoll2: "",
        damageAmount: "",
      };
      if (hasTargetDualRoll(target.id)) {
        return isDualHitRollComplete(entry.attackRoll, entry.attackRoll2);
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
          const rollMode = getTargetRollMode(target.id);
          return {
            tokenId: target.id,
            attackRoll: parseD20Roll(entry.attackRoll),
            attackRoll2: rollMode ? parseD20Roll(entry.attackRoll2) : null,
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
        isSave || isAuto || !singleTargetDualRoll ? null : parseD20Roll(attackRoll2),
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
                {hasTargetDisadvantage(target.id) && getTargetRollMode(target.id) !== "advantage" ? (
                  <span className="retro-muted">
                    {protectionActive
                      ? "Disadvantage (Protection)"
                      : disadvantageLabelForTarget(target) ?? "Disadvantage on attack roll"}
                  </span>
                ) : null}
                {attackAdvantageByTokenId[target.id] && getTargetRollMode(target.id) === "advantage" ? (
                  <span className="retro-muted">
                    {advantageLabelForTarget(target) ?? "Advantage on attack roll"}
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
                  {formatTargetStatLine(
                    target,
                    charactersById,
                    enemiesBySlug,
                    damageTakenByTokenId,
                    showDmUi
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {!isSave && !multiTarget ? (
          <div className="combat-attack-submit-fields">
            {!isAuto ? (
              singleTargetRollMode === "disadvantage" ? (
                <DisadvantageHitRollField
                  roll1={attackRoll}
                  roll2={attackRoll2}
                  onRoll1Change={setAttackRoll}
                  onRoll2Change={setAttackRoll2}
                  attackBonus={attack.attackBonus}
                  disabled={submitting}
                />
              ) : singleTargetRollMode === "advantage" ? (
                <AdvantageHitRollField
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
              twoHandedDisabled={!twoHandedGripAllowed}
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
              twoHandedDisabled={!twoHandedGripAllowed}
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
              const rollMode = getTargetRollMode(target.id);
              return (
                <div key={target.id} className="combat-attack-submit-target-block">
                  <strong>{target.label}</strong>
                  {rollMode === "disadvantage" ? (
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
                  ) : rollMode === "advantage" ? (
                    <AdvantageHitRollField
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
