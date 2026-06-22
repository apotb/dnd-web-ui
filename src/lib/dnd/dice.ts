export interface ParsedDamageNotation {
  /** Sides of each die to roll, e.g. [6, 6] for 2d6. */
  dice: number[];
  modifier: number;
  notation: string;
}

/** Parse standard NdM±X damage notation for manual roll inputs. */
export function parseDamageNotation(notation: string): ParsedDamageNotation | null {
  const trimmed = notation.trim();
  const match = trimmed.match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
  if (!match) return null;

  const count = Number.parseInt(match[1], 10);
  const sides = Number.parseInt(match[2], 10);
  const sign = match[3] ?? "+";
  const modValue = match[4] ? Number.parseInt(match[4], 10) : 0;
  const modifier = sign === "-" ? -modValue : modValue;

  if (count <= 0 || sides <= 0) return null;

  return {
    dice: Array.from({ length: count }, () => sides),
    modifier,
    notation: trimmed,
  };
}

export function sumDamageRollValues(
  rolls: string[],
  dice: number[],
  modifier: number
): number | null {
  if (rolls.length !== dice.length) return null;
  if (dice.some((sides, index) => parseDieRoll(rolls[index] ?? "", sides) == null)) {
    return null;
  }

  const diceSum = rolls.reduce(
    (sum, value, index) => sum + (parseDieRoll(value, dice[index]) ?? 0),
    0
  );
  return diceSum + modifier;
}

/** Keep only digits and clamp to a valid result for the die (1..sides). */
export function sanitizeDieRollInput(raw: string, sides: number): string {
  const digitsOnly = raw.replace(/\D/g, "");
  if (!digitsOnly) return "";

  const normalized = digitsOnly.replace(/^0+/, "");
  if (!normalized) return "";

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return "";
  if (parsed > sides) return String(sides);

  return String(parsed);
}

export function parseDieRoll(value: string, sides: number): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > sides) return null;

  return parsed;
}

export function parseD20Roll(value: string): number | null {
  return parseDieRoll(value, 20);
}

export function isD20RollComplete(value: string): boolean {
  return parseD20Roll(value) != null;
}

export function areDamageRollsComplete(damageDice: string, rolls: string[]): boolean {
  const parsed = parseDamageNotation(damageDice);
  if (!parsed) return false;
  if (rolls.length !== parsed.dice.length) return false;
  return parsed.dice.every((sides, index) => parseDieRoll(rolls[index] ?? "", sides) != null);
}

export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollD20(): number {
  return rollDie(20);
}

export interface DamageRollResult {
  rolls: number[];
  modifier: number;
  total: number;
  notation: string;
}

/** Roll damage from notation like "1d8+3", "2d6", or "1d10-1". */
export function rollDamage(notation: string): DamageRollResult | null {
  const trimmed = notation.trim();
  const match = trimmed.match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
  if (!match) return null;

  const count = Number.parseInt(match[1], 10);
  const sides = Number.parseInt(match[2], 10);
  const sign = match[3] ?? "+";
  const modValue = match[4] ? Number.parseInt(match[4], 10) : 0;
  const modifier = sign === "-" ? -modValue : modValue;

  const rolls: number[] = [];
  for (let i = 0; i < count; i++) {
    rolls.push(rollDie(sides));
  }

  const total = rolls.reduce((sum, value) => sum + value, 0) + modifier;

  return {
    rolls,
    modifier,
    total,
    notation: trimmed,
  };
}

export function formatDamageRoll(result: DamageRollResult): string {
  const dicePart =
    result.rolls.length > 0 ? `[${result.rolls.join(", ")}]` : "";
  const modPart =
    result.modifier !== 0
      ? `${result.modifier >= 0 ? " + " : " − "}${Math.abs(result.modifier)}`
      : "";
  return `${dicePart}${modPart} = ${result.total}`;
}
