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
