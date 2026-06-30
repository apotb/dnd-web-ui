import type { ParsedCharacter } from "@/lib/character/utils";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";

export function isBattleActive(state: CombatState): boolean {
  return (
    state.turn.active &&
    state.initiative.status === "ready" &&
    state.initiative.order.length > 0
  );
}

export function getCurrentTurnTokenId(state: CombatState): string | null {
  if (!isBattleActive(state)) return null;
  return state.initiative.order[state.turn.index] ?? null;
}

export function getCurrentTurnToken(state: CombatState): CombatToken | null {
  const tokenId = getCurrentTurnTokenId(state);
  if (!tokenId) return null;
  return state.tokens.find((token) => token.id === tokenId) ?? null;
}

export function getNextTurnTokenId(state: CombatState): string | null {
  if (!isBattleActive(state)) return null;
  const order = state.initiative.order;
  if (order.length === 0) return null;

  let nextIndex = state.turn.index + 1;
  if (nextIndex >= order.length) {
    nextIndex = 0;
  }

  return order[nextIndex] ?? null;
}

export function getNextTurnToken(state: CombatState): CombatToken | null {
  const tokenId = getNextTurnTokenId(state);
  if (!tokenId) return null;
  return state.tokens.find((token) => token.id === tokenId) ?? null;
}

export function isDmControlledToken(
  token: CombatToken,
  character: ParsedCharacter | null
): boolean {
  if (token.kind === "enemy" || token.kind === "ally") return true;
  if (token.kind === "party") {
    return !character?.owner_user_id;
  }
  return true;
}

export function canUserActForToken(
  userId: string | null,
  isDm: boolean,
  token: CombatToken,
  character: ParsedCharacter | null
): boolean {
  if (isDmControlledToken(token, character)) {
    return isDm;
  }

  return !!userId && character?.owner_user_id === userId;
}

export function canUserControlTurn(
  userId: string | null,
  isDm: boolean,
  state: CombatState,
  token: CombatToken | null,
  character: ParsedCharacter | null
): boolean {
  if (!isBattleActive(state) || !token) return false;
  if (getCurrentTurnTokenId(state) !== token.id) return false;

  if (isDmControlledToken(token, character)) {
    return isDm;
  }

  return !!userId && character?.owner_user_id === userId;
}

export function canUserEndTurn(
  userId: string | null,
  isDm: boolean,
  state: CombatState,
  token: CombatToken | null,
  character: ParsedCharacter | null
): boolean {
  return canUserControlTurn(userId, isDm, state, token, character);
}

export const TURN_RESET_FIELDS = {
  movementUsedFeet: 0,
  dashUsed: false,
  actionUsedForTwoWeapon: false,
  actionUsed: false,
  bonusActionUsed: false,
  disengageUsed: false,
  freeObjectInteractionUsed: false,
} as const;

export function advanceTurn(state: CombatState): CombatState {
  if (!isBattleActive(state)) return state;

  const order = state.initiative.order;
  if (order.length === 0) return state;

  let nextIndex = state.turn.index + 1;
  let nextRound = state.turn.round;
  if (nextIndex >= order.length) {
    nextIndex = 0;
    nextRound += 1;
  }

  return {
    ...state,
    turn: {
      active: true,
      index: nextIndex,
      round: nextRound,
      ...TURN_RESET_FIELDS,
    },
    pendingOpportunityAttacks: null,
  };
}

export function applyMainHandAttackUsed(state: CombatState): CombatState {
  if (!isBattleActive(state)) return state;
  if (state.turn.actionUsedForTwoWeapon) return state;

  return {
    ...state,
    turn: {
      ...state.turn,
      actionUsedForTwoWeapon: true,
    },
  };
}

export function applyActionUsed(state: CombatState): CombatState {
  if (!isBattleActive(state)) return state;
  if (state.turn.actionUsed) return state;

  return {
    ...state,
    turn: {
      ...state.turn,
      actionUsed: true,
    },
  };
}

export function applyDashActionUsed(state: CombatState): CombatState {
  if (!isBattleActive(state)) return state;
  if (state.turn.dashUsed || state.turn.actionUsed) return state;

  return {
    ...state,
    turn: {
      ...state.turn,
      dashUsed: true,
      actionUsed: true,
    },
  };
}

export function applyDisengageUsed(state: CombatState): CombatState {
  if (!isBattleActive(state)) return state;
  if (state.turn.disengageUsed) return state;

  return {
    ...state,
    turn: {
      ...state.turn,
      disengageUsed: true,
      actionUsed: true,
    },
  };
}

export function applyFreeObjectInteractionUsed(state: CombatState): CombatState {
  if (!isBattleActive(state)) return state;
  if (state.turn.freeObjectInteractionUsed) return state;

  return {
    ...state,
    turn: {
      ...state.turn,
      freeObjectInteractionUsed: true,
    },
  };
}

export function adjustTurnAfterTokenRemoved(
  turn: CombatState["turn"],
  removedTokenId: string,
  order: string[]
): CombatState["turn"] {
  if (!turn.active || order.length === 0) {
    return { active: false, index: 0, round: turn.round, ...TURN_RESET_FIELDS };
  }

  const removedIndex = order.indexOf(removedTokenId);
  if (removedIndex === -1) {
    return {
      ...turn,
      index: Math.min(turn.index, order.length - 1),
    };
  }

  let nextIndex = turn.index;
  if (removedIndex < turn.index) {
    nextIndex = Math.max(0, turn.index - 1);
  } else if (removedIndex === turn.index) {
    nextIndex = turn.index >= order.length ? 0 : turn.index;
  }

  return {
    ...turn,
    index: Math.min(nextIndex, order.length - 1),
  };
}
