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
  modifier: number,
  parseValue: (value: string) => number | null
): number | null {
  if (rolls.some((value) => !value.trim())) return null;
  const diceSum = rolls.reduce((sum, value) => sum + (parseValue(value) ?? 0), 0);
  return diceSum + modifier;
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
