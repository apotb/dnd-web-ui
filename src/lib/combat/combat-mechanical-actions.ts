import type { ParsedCharacter } from "@/lib/character/utils";
import {
  ACTION_COST_LABELS,
  actionSourceBadgeLabel,
  type CharacterActionEntry,
} from "@/lib/dnd/character-actions";
import type { FeatureCatalogs } from "@/lib/character/feature-choices";
import {
  canLayOnHandsCureTarget,
  canLayOnHandsHealTarget,
  getLayOnHandsPoolRemaining,
  LAY_ON_HANDS_ACTION_ID,
  LAY_ON_HANDS_ID,
  mechanicalFeatureQualifies,
} from "@/lib/dnd/mechanical-features";
import { getAdjacentAllyTokens } from "@/lib/combat/engagement";
import { isTokenInShellDefense } from "@/lib/combat/feature-effects";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import type { CombatOption } from "@/lib/combat/combat-options";

export { LAY_ON_HANDS_ACTION_ID } from "@/lib/dnd/mechanical-features";

export interface LayOnHandsCombatTarget {
  token: CombatToken;
  character: ParsedCharacter;
}

export function isLayOnHandsOption(option: CombatOption): boolean {
  return option.action?.id === LAY_ON_HANDS_ACTION_ID;
}

export function getLayOnHandsTouchTargets(
  actorToken: CombatToken,
  actorCharacter: ParsedCharacter,
  combatState: CombatState,
  partyCharacters: ParsedCharacter[]
): LayOnHandsCombatTarget[] {
  const byId = new Map(partyCharacters.map((entry) => [entry.id, entry]));
  const targets: LayOnHandsCombatTarget[] = [];

  if (actorToken.characterId) {
    const self =
      byId.get(actorToken.characterId) ??
      (actorCharacter.id === actorToken.characterId ? actorCharacter : null);
    if (self) {
      targets.push({ token: actorToken, character: self });
    }
  }

  for (const allyToken of getAdjacentAllyTokens(actorToken, combatState)) {
    if (allyToken.kind !== "party" || !allyToken.characterId) continue;
    const character = byId.get(allyToken.characterId);
    if (character) {
      targets.push({ token: allyToken, character });
    }
  }

  return targets;
}

export function hasLayOnHandsValidTarget(
  actorToken: CombatToken,
  actorCharacter: ParsedCharacter,
  combatState: CombatState,
  partyCharacters: ParsedCharacter[],
  catalogs?: FeatureCatalogs
): boolean {
  if (!mechanicalFeatureQualifies(actorCharacter.data, LAY_ON_HANDS_ID, catalogs)) {
    return false;
  }

  const pool = getLayOnHandsPoolRemaining(actorCharacter.data, catalogs);
  if (pool <= 0) return false;

  const targets = getLayOnHandsTouchTargets(
    actorToken,
    actorCharacter,
    combatState,
    partyCharacters
  );

  return targets.some(({ character }) => {
    if (canLayOnHandsHealTarget(character.data, 1, catalogs)) return true;
    return canLayOnHandsCureTarget(character.data, pool);
  });
}

export function findLayOnHandsAction(
  characterActions: CharacterActionEntry[]
): CharacterActionEntry | null {
  return characterActions.find((action) => action.id === LAY_ON_HANDS_ACTION_ID) ?? null;
}

export function canShowLayOnHandsOption(
  actorToken: CombatToken,
  turn: { actionUsed: boolean },
  battleOver: boolean
): boolean {
  return !battleOver && !turn.actionUsed && !isTokenInShellDefense(actorToken);
}

export function formatLayOnHandsCombatSubtitle(poolRemaining: number): string {
  return `${ACTION_COST_LABELS.action} · ${poolRemaining} HP pool`;
}

export function formatLayOnHandsCombatTooltip(
  action: CharacterActionEntry,
  poolRemaining: number
): string {
  const lines = [
    `${ACTION_COST_LABELS.action} · ${actionSourceBadgeLabel(action)}`,
    `${poolRemaining} HP remaining in pool`,
  ];
  const description = action.description.trim();
  if (description) lines.push(description);
  return lines.join("\n");
}
