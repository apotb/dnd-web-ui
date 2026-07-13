import { applyBattleOverEconomyReset, isBattleOver } from "@/lib/combat/battle-over";
import {
  areTokensWithinMeleeRange,
  getAdjacentAllyTokens,
  isAllyToken,
} from "@/lib/combat/engagement";
import { isBattleActive } from "@/lib/combat/turn";
import type { CombatHelpGrant, CombatState, CombatToken } from "@/lib/schemas/combat-state";

export type AttackRollMode = "advantage" | "disadvantage" | null;

export function resolveAttackRollMode(
  advantage: boolean,
  disadvantage: boolean
): AttackRollMode {
  if (advantage && disadvantage) return null;
  if (advantage) return "advantage";
  if (disadvantage) return "disadvantage";
  return null;
}

export function resolveEffectiveAttackRoll(
  roll: number,
  roll2: number | null | undefined,
  mode: AttackRollMode
): number {
  if (!mode || roll2 == null) return roll;
  if (mode === "advantage") return Math.max(roll, roll2);
  return Math.min(roll, roll2);
}

export function applyHelpGrant(
  state: CombatState,
  helperTokenId: string,
  beneficiaryTokenId: string
): CombatState {
  if (!isBattleActive(state)) return state;

  const helper = state.tokens.find((token) => token.id === helperTokenId);
  const beneficiary = state.tokens.find((token) => token.id === beneficiaryTokenId);
  if (!helper || !beneficiary) return state;
  if (!helper.placed || !beneficiary.placed) return state;
  if (!isAllyToken(helper, beneficiary)) return state;
  if (!areTokensWithinMeleeRange(helper, beneficiary)) return state;

  if (isBattleOver(state)) {
    return { ...state, turn: applyBattleOverEconomyReset(state.turn) };
  }
  if (state.turn.actionUsed) return state;

  const grant: CombatHelpGrant = { helperTokenId, beneficiaryTokenId };
  return {
    ...state,
    turn: { ...state.turn, actionUsed: true },
    helpGrants: [...(state.helpGrants ?? []), grant],
  };
}

export function getHelpAttackAdvantage(
  attacker: CombatToken,
  target: CombatToken,
  state: CombatState
): boolean {
  const grants = state.helpGrants ?? [];
  if (grants.length === 0) return false;

  return grants.some((grant) => {
    if (grant.beneficiaryTokenId !== attacker.id) return false;
    const helper = state.tokens.find((token) => token.id === grant.helperTokenId);
    if (!helper?.placed) return false;
    return areTokensWithinMeleeRange(helper, target);
  });
}

export function getHelpAttackAdvantageLabel(
  attacker: CombatToken,
  target: CombatToken,
  state: CombatState
): string | null {
  const grants = state.helpGrants ?? [];
  for (const grant of grants) {
    if (grant.beneficiaryTokenId !== attacker.id) continue;
    const helper = state.tokens.find((token) => token.id === grant.helperTokenId);
    if (!helper?.placed) continue;
    if (!areTokensWithinMeleeRange(helper, target)) continue;
    const label = helper.displayName?.trim() || helper.label || helper.name || "Ally";
    return `Help from ${label}`;
  }
  return null;
}

export function canApplyHelpGrant(
  helper: CombatToken,
  beneficiaryTokenId: string,
  state: CombatState
): boolean {
  const beneficiary = state.tokens.find((token) => token.id === beneficiaryTokenId);
  if (!beneficiary) return false;
  if (!isAllyToken(helper, beneficiary)) return false;
  if (!areTokensWithinMeleeRange(helper, beneficiary)) return false;
  return getAdjacentAllyTokens(helper, state).some((ally) => ally.id === beneficiaryTokenId);
}

export function consumeHelpGrantsForBeneficiary(
  state: CombatState,
  beneficiaryTokenId: string
): CombatState {
  const grants = state.helpGrants ?? [];
  const nextGrants = grants.filter(
    (grant) => grant.beneficiaryTokenId !== beneficiaryTokenId
  );
  if (nextGrants.length === grants.length) return state;
  return { ...state, helpGrants: nextGrants };
}

export function expireHelpGrantsForHelper(
  state: CombatState,
  helperTokenId: string
): CombatState {
  const grants = state.helpGrants ?? [];
  const nextGrants = grants.filter((grant) => grant.helperTokenId !== helperTokenId);
  if (nextGrants.length === grants.length) return state;
  return { ...state, helpGrants: nextGrants };
}
