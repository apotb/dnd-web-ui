import { getDmSaveTargets } from "@/lib/combat/pending-attack-builder";
import type { CombatState, PendingAttack } from "@/lib/schemas/combat-state";

export function getPendingAttacks(state: CombatState): PendingAttack[] {
  return state.pendingAttacks;
}

export function hasPendingAttackForAttacker(
  state: CombatState,
  attackerTokenId: string
): boolean {
  return getPendingAttacks(state).some(
    (attack) => attack.attackerTokenId === attackerTokenId
  );
}

export function getPendingAttackForAttacker(
  state: CombatState,
  attackerTokenId: string
): PendingAttack | null {
  return (
    getPendingAttacks(state).find(
      (attack) => attack.attackerTokenId === attackerTokenId
    ) ?? null
  );
}

export function getPendingAttackById(
  state: CombatState,
  pendingAttackId: string
): PendingAttack | null {
  return (
    getPendingAttacks(state).find((attack) => attack.id === pendingAttackId) ?? null
  );
}

export function addPendingAttack(
  state: CombatState,
  pending: PendingAttack
): CombatState {
  return {
    ...state,
    pendingAttacks: [...getPendingAttacks(state), pending],
  };
}

export function updatePendingAttack(
  state: CombatState,
  pendingAttackId: string,
  pending: PendingAttack
): CombatState {
  return {
    ...state,
    pendingAttacks: getPendingAttacks(state).map((attack) =>
      attack.id === pendingAttackId ? pending : attack
    ),
  };
}

export function removePendingAttack(
  state: CombatState,
  pendingAttackId: string
): CombatState {
  return {
    ...state,
    pendingAttacks: getPendingAttacks(state).filter(
      (attack) => attack.id !== pendingAttackId
    ),
  };
}

export function canAdvanceTurnWithPendingAttacks(state: CombatState): boolean {
  const order = state.initiative.order;
  const tokenId = order[state.turn.index];
  if (!tokenId) return true;
  return !hasPendingAttackForAttacker(state, tokenId);
}

export function getDmApprovalTrayAttacks(pendingAttacks: PendingAttack[]): PendingAttack[] {
  return pendingAttacks.filter((pending) => {
    if (!pending.skipDmReview) return true;
    return (
      pending.status === "awaiting-saves" && getDmSaveTargets(pending).length > 0
    );
  });
}
