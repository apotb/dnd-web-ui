import type { ParsedCharacter } from "@/lib/character/utils";
import {
  ACTION_COST_LABELS,
  actionSourceBadgeLabel,
  type CharacterActionEntry,
} from "@/lib/dnd/character-actions";
import type { FeatureCatalogs } from "@/lib/character/feature-choices";
import { featureIdFromActionId } from "@/lib/dnd/catalog-feature-mechanics";
import {
  canHpPoolCureTarget,
  canHpPoolHealTarget,
  getHpPoolRemaining,
  getResolvedMechanicalFeature,
  LAY_ON_HANDS_ACTION_ID,
  LAY_ON_HANDS_ID,
  mechanicalFeatureQualifies,
} from "@/lib/dnd/mechanical-features";
import { getAdjacentAllyTokens } from "@/lib/combat/engagement";
import { isTokenInShellDefense } from "@/lib/combat/feature-effects";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import type { CombatOption } from "@/lib/combat/combat-options";

export { LAY_ON_HANDS_ACTION_ID, LAY_ON_HANDS_ID } from "@/lib/dnd/mechanical-features";

export interface HpPoolCombatTarget {
  token: CombatToken;
  character: ParsedCharacter;
}

export function isHpPoolCombatOption(
  option: CombatOption,
  actorData?: import("@/lib/schemas/character").CharacterData,
  catalogs?: FeatureCatalogs
): boolean {
  const actionId = option.action?.id;
  if (!actionId) return false;
  if (!actorData) return actionId === LAY_ON_HANDS_ACTION_ID;
  const featureId = featureIdFromActionId(actionId);
  if (!featureId) return false;
  const resolved = getResolvedMechanicalFeature(actorData, featureId, catalogs);
  return resolved?.kind === "hp-pool" && resolved.usesAction === true;
}

/** @deprecated Use isHpPoolCombatOption */
export function isLayOnHandsOption(option: CombatOption): boolean {
  return isHpPoolCombatOption(option);
}

export function getHpPoolTouchTargets(
  actorToken: CombatToken,
  actorCharacter: ParsedCharacter,
  combatState: CombatState,
  partyCharacters: ParsedCharacter[]
): HpPoolCombatTarget[] {
  const byId = new Map(partyCharacters.map((entry) => [entry.id, entry]));
  const targets: HpPoolCombatTarget[] = [];

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

export function hasHpPoolValidTarget(
  featureId: string,
  actorToken: CombatToken,
  actorCharacter: ParsedCharacter,
  combatState: CombatState,
  partyCharacters: ParsedCharacter[],
  catalogs?: FeatureCatalogs
): boolean {
  if (!mechanicalFeatureQualifies(actorCharacter.data, featureId, catalogs)) {
    return false;
  }

  const resolved = getResolvedMechanicalFeature(actorCharacter.data, featureId, catalogs);
  if (!resolved || resolved.kind !== "hp-pool") return false;

  const pool = getHpPoolRemaining(actorCharacter.data, featureId, catalogs);
  if (pool <= 0) return false;

  const targets = getHpPoolTouchTargets(
    actorToken,
    actorCharacter,
    combatState,
    partyCharacters
  );

  return targets.some(({ character }) => {
    if (canHpPoolHealTarget(character.data, 1, catalogs)) return true;
    return canHpPoolCureTarget(character.data, pool, resolved);
  });
}

export function findHpPoolAction(
  featureId: string,
  characterActions: CharacterActionEntry[]
): CharacterActionEntry | null {
  return characterActions.find((action) => action.id === `feature:${featureId}`) ?? null;
}

export function canShowHpPoolOption(
  actorToken: CombatToken,
  turn: { actionUsed: boolean },
  battleOver: boolean
): boolean {
  return !battleOver && !turn.actionUsed && !isTokenInShellDefense(actorToken);
}

export function formatHpPoolCombatSubtitle(
  actionCost: CharacterActionEntry["cost"],
  poolRemaining: number
): string {
  return `${ACTION_COST_LABELS[actionCost]} · ${poolRemaining} HP pool`;
}

export function formatHpPoolCombatTooltip(
  action: CharacterActionEntry,
  poolRemaining: number
): string {
  const lines = [
    `${ACTION_COST_LABELS[action.cost]} · ${actionSourceBadgeLabel(action)}`,
    `${poolRemaining} HP remaining in pool`,
  ];
  const description = action.description.trim();
  if (description) lines.push(description);
  return lines.join("\n");
}

/** @deprecated Use HpPoolCombatTarget */
export type LayOnHandsCombatTarget = HpPoolCombatTarget;

export const getLayOnHandsTouchTargets = getHpPoolTouchTargets;

export function hasLayOnHandsValidTarget(
  actorToken: CombatToken,
  actorCharacter: ParsedCharacter,
  combatState: CombatState,
  partyCharacters: ParsedCharacter[],
  catalogs?: FeatureCatalogs
): boolean {
  return hasHpPoolValidTarget(
    LAY_ON_HANDS_ID,
    actorToken,
    actorCharacter,
    combatState,
    partyCharacters,
    catalogs
  );
}

export function findLayOnHandsAction(
  characterActions: CharacterActionEntry[]
): CharacterActionEntry | null {
  return findHpPoolAction(LAY_ON_HANDS_ID, characterActions);
}

export const canShowLayOnHandsOption = canShowHpPoolOption;

export function formatLayOnHandsCombatSubtitle(poolRemaining: number): string {
  return formatHpPoolCombatSubtitle("action", poolRemaining);
}

export function formatLayOnHandsCombatTooltip(
  action: CharacterActionEntry,
  poolRemaining: number
): string {
  return formatHpPoolCombatTooltip(action, poolRemaining);
}
