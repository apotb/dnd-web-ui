import { isBattleActive, TURN_RESET_FIELDS } from "@/lib/combat/turn";
import type { CombatState, CombatToken, CombatTurn } from "@/lib/schemas/combat-state";

export function isLivingEnemy(token: CombatToken): boolean {
  return token.kind === "enemy" && (token.currentHp ?? 0) > 0;
}

export function isBattleOver(state: CombatState): boolean {
  return isBattleActive(state) && !state.tokens.some(isLivingEnemy);
}

export function isTokenOnMapEdge(token: CombatToken, state: CombatState): boolean {
  return (
    token.x === 0 ||
    token.y === 0 ||
    token.x + token.width >= state.gridWidth ||
    token.y + token.height >= state.gridHeight
  );
}

export function applyBattleOverEconomyReset(turn: CombatTurn): CombatTurn {
  return { ...turn, ...TURN_RESET_FIELDS };
}

/** Turn economy fields as if battle over (full budget always available in UI). */
export function getBattleOverTurnDisplay(): Pick<
  CombatTurn,
  | "movementUsedFeet"
  | "dashUsed"
  | "actionUsedForTwoWeapon"
  | "twoWeaponFightingUsedOffHand"
  | "actionUsed"
  | "bonusActionUsed"
  | "disengageUsed"
  | "freeObjectInteractionUsed"
> {
  return { ...TURN_RESET_FIELDS };
}
