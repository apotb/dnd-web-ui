import type { ParsedCharacter } from "@/lib/character/utils";
import { isDmControlledToken } from "@/lib/combat/turn";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import type { GridPosition } from "@/lib/combat/movement";
import { applyCombatMove } from "@/lib/combat/movement";

export function hasPendingOpportunityAttacks(state: CombatState): boolean {
  return (state.pendingOpportunityAttacks?.pendingAttackerTokenIds.length ?? 0) > 0;
}
export function canAdvanceTurnWithOpportunityAttacks(state: CombatState): boolean {
  return !hasPendingOpportunityAttacks(state);
}

export function hasPendingOpportunityAttackMove(state: CombatState): boolean {
  return state.pendingOpportunityAttacks?.destination != null;
}

export function finalizePendingOpportunityAttackMove(state: CombatState): CombatState {
  const pending = state.pendingOpportunityAttacks;
  if (!pending?.destination) {
    return { ...state, pendingOpportunityAttacks: null };
  }

  return applyCombatMove(
    { ...state, pendingOpportunityAttacks: null },
    pending.provokingTokenId,
    pending.destination,
    pending.costFeet ?? 0,
    pending.dashConsumed ?? false
  );
}

export function applyCombatMoveWithOpportunityAttacks(
  state: CombatState,
  tokenId: string,
  destination: GridPosition,
  costFeet: number,
  dashConsumed: boolean,
  opportunityAttackerTokenIds: string[]
): CombatState {
  if (opportunityAttackerTokenIds.length === 0) {
    return applyCombatMove(state, tokenId, destination, costFeet, dashConsumed);
  }

  return {
    ...state,
    pendingOpportunityAttacks: {
      provokingTokenId: tokenId,
      pendingAttackerTokenIds: opportunityAttackerTokenIds,
      destination,
      costFeet,
      dashConsumed,
    },
  };
}

export function canUserControlOpportunityAttack(
  userId: string | null,
  isDm: boolean,
  token: CombatToken,
  character: ParsedCharacter | null
): boolean {
  if (token.kind !== "party") return false;
  if (isDm && isDmControlledToken(token, character)) return true;
  return !!userId && character?.owner_user_id === userId;
}

export function findUserOpportunityAttackAttackerToken(
  state: CombatState,
  charactersById: Record<string, ParsedCharacter>,
  userId: string | null,
  isDm: boolean
): CombatToken | null {
  const pending = state.pendingOpportunityAttacks;
  if (!pending) return null;

  for (const tokenId of pending.pendingAttackerTokenIds) {
    const token = state.tokens.find((entry) => entry.id === tokenId);
    if (!token?.placed) continue;
    const character = token.characterId ? charactersById[token.characterId] ?? null : null;
    if (canUserControlOpportunityAttack(userId, isDm, token, character)) {
      return token;
    }
  }

  return null;
}

export function isAttackerPendingOpportunityAttack(
  state: CombatState,
  attackerTokenId: string
): boolean {
  return (
    state.pendingOpportunityAttacks?.pendingAttackerTokenIds.includes(attackerTokenId) ?? false
  );
}

export function hasSubmittedOpportunityAttack(
  state: CombatState,
  attackerTokenId: string
): boolean {
  return (
    state.pendingAttack?.isOpportunityAttack === true &&
    state.pendingAttack.attackerTokenId === attackerTokenId
  );
}

export function canSkipOpportunityAttackAction(
  state: CombatState,
  attackerTokenId: string
): boolean {
  if (!isAttackerPendingOpportunityAttack(state, attackerTokenId)) return false;
  if (hasSubmittedOpportunityAttack(state, attackerTokenId)) return false;
  return true;
}

export function completeOpportunityAttackForAttacker(
  state: CombatState,
  attackerTokenId: string
): CombatState {
  const pending = state.pendingOpportunityAttacks;
  if (!pending) return state;

  const pendingAttackerTokenIds = pending.pendingAttackerTokenIds.filter(
    (id) => id !== attackerTokenId
  );

  if (pendingAttackerTokenIds.length === 0) {
    return finalizePendingOpportunityAttackMove(state);
  }

  return {
    ...state,
    pendingOpportunityAttacks: {
      ...pending,
      pendingAttackerTokenIds,
    },
  };
}

export function skipOpportunityAttackForAttacker(
  state: CombatState,
  attackerTokenId: string
): CombatState {
  return completeOpportunityAttackForAttacker(state, attackerTokenId);
}
