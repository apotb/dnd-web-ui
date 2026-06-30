import type { CombatToken } from "@/lib/schemas/combat-state";

/** First word of a character name for compact combat labels (e.g. "Frosque Lendal" → "Frosque"). */
export function getPartyTokenLabel(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return trimmed;
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function getCombatTokenDisplayLabel(token: CombatToken): string {
  if (token.kind === "party") {
    return getPartyTokenLabel(token.name || token.label);
  }
  const forcedName = token.displayName?.trim();
  if (forcedName) return forcedName;
  return token.label;
}

/** Disambiguation letter for grouped enemy tokens (e.g. "Thug A" → "A"). */
export function getEnemyTokenLabelLetter(token: CombatToken): string | null {
  if (token.kind !== "enemy") return null;

  const name = token.name.trim();
  const label = token.label.trim();
  if (!name || label === name) return null;

  const prefix = `${name} `;
  if (!label.startsWith(prefix)) return null;

  const suffix = label.slice(prefix.length);
  return /^[A-Z]$/.test(suffix) ? suffix : null;
}
