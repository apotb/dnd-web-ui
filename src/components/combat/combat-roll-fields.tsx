"use client";

import {
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

interface DamageRollFieldProps {
  damageDice: string;
  rolls: string[];
  onRollsChange: (rolls: string[]) => void;
  fallbackTotal: string;
  onFallbackTotalChange: (value: string) => void;
  knownTotal?: number | null;
  disabled?: boolean;
}

export function DamageRollField({
  damageDice,
  rolls,
  onRollsChange,
  fallbackTotal,
  onFallbackTotalChange,
  knownTotal = null,
  disabled = false,
}: DamageRollFieldProps) {
  const parsed = parseDamageNotation(damageDice);
  const rolledTotal =
    parsed != null ? sumDamageRollValues(rolls, parsed.dice, parsed.modifier) : null;
  const total = rolledTotal ?? knownTotal ?? parseOptionalInt(fallbackTotal);
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
      </div>
    );
  }

  return (
    <div className="combat-attack-submit-field">
      <span>Roll for damage</span>
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
        <span className="combat-roll-sep">=</span>
        <span className="combat-roll-total" aria-live="polite">
          {total ?? "—"}
        </span>
      </div>
    </div>
  );
}

export function getDamageSubmitValues(
  damageDice: string,
  rolls: string[],
  fallbackTotal: string
): { damageText: string; damageRolls: number[]; damageAmount: number | null } {
  const parsed = parseDamageNotation(damageDice);
  const damageRolls =
    parsed != null
      ? parsed.dice
          .map((sides, index) => parseDieRoll(rolls[index] ?? "", sides))
          .filter((value): value is number => value != null)
      : rolls
          .map((value) => parseOptionalInt(value))
          .filter((value): value is number => value != null);

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
    damageAmount: sumDamageRollValues(rolls, parsed.dice, parsed.modifier),
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
  disabled?: boolean;
}

export function DamageAppliedField({
  computedDamage,
  overrideValue,
  onOverrideChange,
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
