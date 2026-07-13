import { expireHelpGrantsForHelper } from "@/lib/combat/help";
import type { ParsedCharacter } from "@/lib/character/utils";
import { applyBattleOverEconomyReset, isBattleOver } from "@/lib/combat/battle-over";
import { needsDeathSavingThrow } from "@/lib/dnd/dying-state";
import type { CharacterData } from "@/lib/schemas/character";
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

export function canAdvanceTurnWithDeathSave(
  state: CombatState,
  combat: CharacterData["combat"] | null | undefined
): boolean {
  if (state.turn.deathSaveRolled) return true;

  const token = getCurrentTurnToken(state);
  if (!token || token.kind !== "party" || !combat) return true;

  return !needsDeathSavingThrow(combat);
}

export const TURN_RESET_FIELDS = {
  movementUsedFeet: 0,
  dashUsed: false,
  actionUsedForTwoWeapon: false,
  twoWeaponFightingUsedOffHand: null,
  actionUsed: false,
  bonusActionUsed: false,
  disengageUsed: false,
  freeObjectInteractionUsed: false,
  deathSaveRolled: false,
  multiattackBranchIndex: null,
  multiattackRemaining: {},
  multiattackTokenId: null,
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

  const startingTokenId = order[nextIndex];

  return {
    ...state,
    turn: {
      active: true,
      index: nextIndex,
      round: nextRound,
      ...TURN_RESET_FIELDS,
    },
    pendingOpportunityAttacks: null,
    reactionUsedTokenIds: state.reactionUsedTokenIds.filter(
      (tokenId) => tokenId !== startingTokenId
    ),
    helpGrants: expireHelpGrantsForHelper(state, startingTokenId).helpGrants,
  };
}

export function applyMainHandAttackUsed(state: CombatState): CombatState {
  if (!isBattleActive(state)) return state;
  if (isBattleOver(state)) {
    return { ...state, turn: applyBattleOverEconomyReset(state.turn) };
  }
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
  if (isBattleOver(state)) {
    return { ...state, turn: applyBattleOverEconomyReset(state.turn) };
  }
  if (state.turn.actionUsed) return state;

  return {
    ...state,
    turn: {
      ...state.turn,
      actionUsed: true,
    },
  };
}

export function applyActionGranted(state: CombatState): CombatState {
  if (!isBattleActive(state)) return state;
  if (
    !state.turn.actionUsed &&
    !state.turn.bonusActionUsed &&
    !state.turn.freeObjectInteractionUsed
  ) {
    return state;
  }

  return {
    ...state,
    turn: {
      ...state.turn,
      actionUsed: false,
      bonusActionUsed: false,
      freeObjectInteractionUsed: false,
    },
  };
}

export function applyDashActionUsed(state: CombatState): CombatState {
  if (!isBattleActive(state)) return state;
  if (isBattleOver(state)) {
    return { ...state, turn: applyBattleOverEconomyReset(state.turn) };
  }
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

export function applyBonusActionUsed(state: CombatState): CombatState {
  if (!isBattleActive(state)) return state;
  if (isBattleOver(state)) {
    return { ...state, turn: applyBattleOverEconomyReset(state.turn) };
  }
  if (state.turn.bonusActionUsed) return state;

  return {
    ...state,
    turn: {
      ...state.turn,
      bonusActionUsed: true,
    },
  };
}

export function applyGetUpMovementUsed(
  state: CombatState,
  costFeet: number,
  maxMovementFeet: number
): CombatState {
  if (!isBattleActive(state)) return state;
  if (isBattleOver(state)) return state;
  if (costFeet <= 0) return state;

  const usedFeet = state.turn.movementUsedFeet;
  if (costFeet > maxMovementFeet) return state;

  return {
    ...state,
    turn: {
      ...state.turn,
      movementUsedFeet: usedFeet + costFeet,
    },
  };
}

export function applyDisengageUsed(state: CombatState): CombatState {
  if (!isBattleActive(state)) return state;
  if (isBattleOver(state)) {
    return { ...state, turn: applyBattleOverEconomyReset(state.turn) };
  }
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

export function applyDeathSaveRolled(state: CombatState): CombatState {
  if (!isBattleActive(state)) return state;
  if (state.turn.deathSaveRolled) return state;

  return {
    ...state,
    turn: {
      ...state.turn,
      deathSaveRolled: true,
    },
  };
}

export function applyFreeObjectInteractionUsed(state: CombatState): CombatState {
  if (!isBattleActive(state)) return state;
  if (isBattleOver(state)) {
    return { ...state, turn: applyBattleOverEconomyReset(state.turn) };
  }
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
