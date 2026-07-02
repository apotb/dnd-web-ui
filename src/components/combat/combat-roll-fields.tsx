"use client";

import type { DerivedAttack, WeaponGrip } from "@/lib/dnd/attacks";
import {
  isVersatileWeaponAttack,
  resolveWeaponGripDamageDice,
} from "@/lib/dnd/attacks";
import {
  applyCriticalToDamage,
  isCriticalAttackRoll,
} from "@/lib/combat/attack-resolution";
import {
  applyGreatWeaponFightingRerolls,
  areDamageRollsComplete,
  isD20RollComplete,
  parseDamageNotation,
  parseD20Roll,
  parseDieRoll,
  sanitizeDieRollInput,
  sumDamageRollValues,
} from "@/lib/dnd/dice";

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatRollBonus(value: number): { sign: string; amount: string } {
  if (value >= 0) {
    return { sign: "+", amount: String(value) };
  }
  return { sign: "−", amount: String(Math.abs(value)) };
}

interface HitRollFieldProps {
  value: string;
  onChange: (value: string) => void;
  attackBonus: number;
  disabled?: boolean;
}

export function HitRollField({
  value,
  onChange,
  attackBonus,
  disabled = false,
}: HitRollFieldProps) {
  const roll = parseD20Roll(value);
  const total = roll != null ? roll + attackBonus : null;
  const bonus = formatRollBonus(attackBonus);

  return (
    <div className="combat-attack-submit-field">
      <span>Roll for hit</span>
      <div className="combat-roll-row">
        <input
          type="text"
          inputMode="numeric"
          className="candy-input combat-roll-input"
          placeholder="d20"
          value={value}
          onChange={(event) => onChange(sanitizeDieRollInput(event.target.value, 20))}
          disabled={disabled}
          aria-label="d20 roll"
          aria-invalid={value.trim().length > 0 && !isD20RollComplete(value)}
        />
        <span className="combat-roll-sep">{bonus.sign}</span>
        <span className="combat-roll-mod">{bonus.amount}</span>
        <span className="combat-roll-sep">=</span>
        <span className="combat-roll-total" aria-live="polite">
          {total ?? "—"}
        </span>
      </div>
    </div>
  );
}

interface DisadvantageHitRollFieldProps {
  roll1: string;
  roll2: string;
  onRoll1Change: (value: string) => void;
  onRoll2Change: (value: string) => void;
  attackBonus: number;
  disabled?: boolean;
}

export function isDisadvantageHitRollComplete(roll1: string, roll2: string): boolean {
  return isD20RollComplete(roll1) && isD20RollComplete(roll2);
}

export function DisadvantageHitRollField({
  roll1,
  roll2,
  onRoll1Change,
  onRoll2Change,
  attackBonus,
  disabled = false,
}: DisadvantageHitRollFieldProps) {
  const parsed1 = parseD20Roll(roll1);
  const parsed2 = parseD20Roll(roll2);
  const usedRoll =
    parsed1 != null && parsed2 != null ? Math.min(parsed1, parsed2) : null;
  const total = usedRoll != null ? usedRoll + attackBonus : null;
  const bonus = formatRollBonus(attackBonus);

  return (
    <div className="combat-attack-submit-field">
      <span>Roll for hit (disadvantage — use lower die)</span>
      <div className="combat-roll-row combat-roll-row-wrap">
        <input
          type="text"
          inputMode="numeric"
          className="candy-input combat-roll-input"
          placeholder="d20"
          value={roll1}
          onChange={(event) => onRoll1Change(sanitizeDieRollInput(event.target.value, 20))}
          disabled={disabled}
          aria-label="First d20 roll"
          aria-invalid={roll1.trim().length > 0 && !isD20RollComplete(roll1)}
        />
        <span className="combat-roll-sep">,</span>
        <input
          type="text"
          inputMode="numeric"
          className="candy-input combat-roll-input"
          placeholder="d20"
          value={roll2}
          onChange={(event) => onRoll2Change(sanitizeDieRollInput(event.target.value, 20))}
          disabled={disabled}
          aria-label="Second d20 roll"
          aria-invalid={roll2.trim().length > 0 && !isD20RollComplete(roll2)}
        />
        <span className="combat-roll-sep">→</span>
        <span className="combat-roll-mod">{usedRoll ?? "—"}</span>
        <span className="combat-roll-sep">{bonus.sign}</span>
        <span className="combat-roll-mod">{bonus.amount}</span>
        <span className="combat-roll-sep">=</span>
        <span className="combat-roll-total" aria-live="polite">
          {total ?? "—"}
        </span>
      </div>
    </div>
  );
}

interface WeaponGripFieldProps {
  attack: DerivedAttack;
  value: WeaponGrip;
  onChange: (grip: WeaponGrip) => void;
  disabled?: boolean;
}

export function WeaponGripField({
  attack,
  value,
  onChange,
  disabled = false,
}: WeaponGripFieldProps) {
  if (!isVersatileWeaponAttack(attack)) return null;

  const oneHandedDice = attack.damageDice;
  const twoHandedDice = attack.versatileDamageDice ?? attack.damageDice;
  const groupName = `weapon-grip-${attack.id}`;

  return (
    <div className="combat-attack-submit-field">
      <span>Grip</span>
      <div className="combat-weapon-grip-options" role="radiogroup" aria-label="Weapon grip">
        <label className="combat-weapon-grip-option">
          <input
            type="radio"
            name={groupName}
            value="one-handed"
            checked={value === "one-handed"}
            disabled={disabled}
            onChange={() => onChange("one-handed")}
          />
          <span>One-handed ({oneHandedDice})</span>
        </label>
        <label className="combat-weapon-grip-option">
          <input
            type="radio"
            name={groupName}
            value="two-handed"
            checked={value === "two-handed"}
            disabled={disabled}
            onChange={() => onChange("two-handed")}
          />
          <span>Two-handed ({twoHandedDice})</span>
        </label>
      </div>
    </div>
  );
}

export { isVersatileWeaponAttack, resolveWeaponGripDamageDice };
export type { WeaponGrip };

export function isCriticalHitRollInput(
  roll: string,
  options?: { roll2?: string; disadvantage?: boolean }
): boolean {
  const attackRoll = parseD20Roll(roll);
  if (attackRoll == null) return false;
  const disadvantage = options?.disadvantage ?? false;
  const attackRoll2 = disadvantage ? parseD20Roll(options?.roll2 ?? "") : null;
  if (disadvantage && attackRoll2 == null) return false;
  return isCriticalAttackRoll(attackRoll, { attackRoll2, disadvantage });
}

interface DamageRollFieldProps {
  damageDice: string;
  rolls: string[];
  onRollsChange: (rolls: string[]) => void;
  fallbackTotal: string;
  onFallbackTotalChange: (value: string) => void;
  knownTotal?: number | null;
  critical?: boolean;
  disabled?: boolean;
}

export function DamageRollField({
  damageDice,
  rolls,
  onRollsChange,
  fallbackTotal,
  onFallbackTotalChange,
  knownTotal = null,
  critical = false,
  disabled = false,
}: DamageRollFieldProps) {
  const parsed = parseDamageNotation(damageDice);
  const rolledTotal =
    parsed != null ? sumDamageRollValues(rolls, parsed.dice, parsed.modifier) : null;
  const baseTotal = rolledTotal ?? knownTotal ?? parseOptionalInt(fallbackTotal);
  const displayTotal =
    critical && baseTotal != null ? applyCriticalToDamage(baseTotal, true) : baseTotal;
  const modifier = parsed ? formatRollBonus(parsed.modifier) : null;

  if (!parsed) {
    return (
      <div className="combat-attack-submit-field">
        <span>Damage total</span>
        <input
          type="number"
          min={0}
          className="candy-input"
          placeholder={damageDice || "Damage"}
          value={fallbackTotal}
          onChange={(event) => onFallbackTotalChange(event.target.value)}
          disabled={disabled}
        />
        {critical && baseTotal != null ? (
          <div className="combat-roll-row combat-roll-row-wrap">
            <span className="combat-roll-sep">×</span>
            <span className="combat-roll-mod">2</span>
            <span className="combat-roll-sep">=</span>
            <span className="combat-roll-total combat-roll-total-critical" aria-live="polite">
              {displayTotal}
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="combat-attack-submit-field">
      <span>Roll for damage{critical ? " (critical hit)" : ""}</span>
      <div className="combat-roll-row combat-roll-row-wrap">
        {parsed.dice.map((sides, index) => (
          <span key={index} className="combat-roll-row-item">
            {index > 0 ? <span className="combat-roll-sep">+</span> : null}
            <input
              type="text"
              inputMode="numeric"
              className="candy-input combat-roll-input"
              placeholder={`d${sides}`}
              value={rolls[index] ?? ""}
              onChange={(event) => {
                const next = [...rolls];
                next[index] = sanitizeDieRollInput(event.target.value, sides);
                onRollsChange(next);
              }}
              disabled={disabled}
              aria-label={`d${sides} roll`}
              aria-invalid={
                (rolls[index] ?? "").trim().length > 0 &&
                parseDieRoll(rolls[index] ?? "", sides) == null
              }
            />
          </span>
        ))}
        {parsed.modifier !== 0 && modifier ? (
          <>
            <span className="combat-roll-sep">{modifier.sign}</span>
            <span className="combat-roll-mod">{modifier.amount}</span>
          </>
        ) : null}
        {critical ? (
          <>
            <span className="combat-roll-sep">×</span>
            <span className="combat-roll-mod">2</span>
            <span className="combat-roll-sep">=</span>
            <span className="combat-roll-total combat-roll-total-critical" aria-live="polite">
              {displayTotal ?? "—"}
            </span>
          </>
        ) : (
          <>
            <span className="combat-roll-sep">=</span>
            <span className="combat-roll-total" aria-live="polite">
              {baseTotal ?? "—"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export function getDamageSubmitValues(
  damageDice: string,
  rolls: string[],
  fallbackTotal: string,
  options?: { greatWeaponFighting?: boolean }
): { damageText: string; damageRolls: number[]; damageAmount: number | null } {
  const parsed = parseDamageNotation(damageDice);
  let damageRolls =
    parsed != null
      ? parsed.dice
          .map((sides, index) => parseDieRoll(rolls[index] ?? "", sides))
          .filter((value): value is number => value != null)
      : rolls
          .map((value) => parseOptionalInt(value))
          .filter((value): value is number => value != null);

  if (options?.greatWeaponFighting && parsed && damageRolls.length === parsed.dice.length) {
    damageRolls = applyGreatWeaponFightingRerolls(damageRolls, parsed.dice);
  }

  if (!parsed) {
    return {
      damageText: damageDice,
      damageRolls,
      damageAmount: parseOptionalInt(fallbackTotal),
    };
  }

  return {
    damageText: parsed.notation,
    damageRolls,
    damageAmount: sumDamageRollValues(
      damageRolls.map(String),
      parsed.dice,
      parsed.modifier
    ),
  };
}

export function emptyDamageRolls(damageDice: string): string[] {
  const parsed = parseDamageNotation(damageDice);
  return parsed ? parsed.dice.map(() => "") : [];
}

export function damageRollsToInputValues(
  damageDice: string,
  rolls?: number[]
): string[] {
  const parsed = parseDamageNotation(damageDice);
  if (!parsed) return [];
  return parsed.dice.map((_, index) =>
    rolls?.[index] != null ? String(rolls[index]) : ""
  );
}

export { areDamageRollsComplete, isD20RollComplete, parseD20Roll, sanitizeDieRollInput };

interface DamageAppliedFieldProps {
  computedDamage: number;
  overrideValue: string;
  onOverrideChange: (value: string) => void;
  breakdown?: string | null;
  disabled?: boolean;
}

export function DamageAppliedField({
  computedDamage,
  overrideValue,
  onOverrideChange,
  breakdown = null,
  disabled = false,
}: DamageAppliedFieldProps) {
  const hasOverride = overrideValue.trim().length > 0;

  return (
    <div className="combat-attack-submit-field">
      <span>Damage applied</span>
      <div className="combat-damage-applied-row">
        <span
          className={`combat-damage-applied-value${
            hasOverride ? " combat-damage-applied-struck" : ""
          }`}
          aria-live="polite"
        >
          {computedDamage}
        </span>
        <input
          type="number"
          min={0}
          className="candy-input combat-damage-applied-override"
          placeholder="Override"
          value={overrideValue}
          onChange={(event) => onOverrideChange(event.target.value)}
          disabled={disabled}
          aria-label="Override damage applied"
        />
      </div>
      {breakdown && !hasOverride ? (
        <span className="retro-muted combat-damage-applied-breakdown">{breakdown}</span>
      ) : null}
    </div>
  );
}

interface SaveRollFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SaveRollField({ value, onChange, disabled = false }: SaveRollFieldProps) {
  return (
    <input
      type="text"
      inputMode="numeric"
      className="candy-input combat-roll-input"
      placeholder="d20"
      value={value}
      onChange={(event) => onChange(sanitizeDieRollInput(event.target.value, 20))}
      disabled={disabled}
      aria-label="d20 save roll"
      aria-invalid={value.trim().length > 0 && !isD20RollComplete(value)}
    />
  );
}
