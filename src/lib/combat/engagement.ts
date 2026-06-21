import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import type { GridPosition } from "@/lib/combat/movement";

function footprintCells(token: CombatToken): GridPosition[] {
  const cells: GridPosition[] = [];
  for (let dy = 0; dy < token.height; dy++) {
    for (let dx = 0; dx < token.width; dx++) {
      cells.push({ x: token.x + dx, y: token.y + dy });
    }
  }
  return cells;
}

function cellsAreMeleeAdjacent(a: GridPosition, b: GridPosition): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return dx <= 1 && dy <= 1 && (dx > 0 || dy > 0);
}

export function areTokensWithinMeleeRange(a: CombatToken, b: CombatToken): boolean {
  const aCells = footprintCells(a);
  const bCells = footprintCells(b);
  return aCells.some((ac) => bCells.some((bc) => cellsAreMeleeAdjacent(ac, bc)));
}

export function areTokensEngaged(a: CombatToken, b: CombatToken): boolean {
  return areTokensWithinMeleeRange(a, b);
}

export function isAllyToken(a: CombatToken, b: CombatToken): boolean {
  if (a.id === b.id) return false;
  const aFriendly = a.kind === "party" || a.kind === "ally";
  const bFriendly = b.kind === "party" || b.kind === "ally";
  return aFriendly && bFriendly;
}

export function getAdjacentAllyTokens(
  token: CombatToken,
  state: CombatState
): CombatToken[] {
  if (!token.placed) return [];

  return state.tokens.filter(
    (other) =>
      other.placed &&
      other.id !== token.id &&
      isAllyToken(token, other) &&
      areTokensWithinMeleeRange(token, other)
  );
}

export function canUseHelpAction(token: CombatToken, state: CombatState): boolean {
  return getAdjacentAllyTokens(token, state).length > 0;
}

export function isHostileToken(a: CombatToken, b: CombatToken): boolean {
  if (a.id === b.id) return false;
  const aFriendly = a.kind === "party" || a.kind === "ally";
  const bFriendly = b.kind === "party" || b.kind === "ally";
  const aEnemy = a.kind === "enemy";
  const bEnemy = b.kind === "enemy";
  return (aFriendly && bEnemy) || (aEnemy && bFriendly);
}

export function tokenAtPosition(
  token: CombatToken,
  x: number,
  y: number
): CombatToken {
  return { ...token, x, y };
}

export function getEngagedHostileTokens(
  token: CombatToken,
  state: CombatState
): CombatToken[] {
  if (!token.placed) return [];

  return state.tokens.filter(
    (other) =>
      other.placed &&
      other.id !== token.id &&
      isHostileToken(token, other) &&
      areTokensEngaged(token, other)
  );
}

export function isTokenEngaged(token: CombatToken, state: CombatState): boolean {
  return getEngagedHostileTokens(token, state).length > 0;
}

/** Hostiles that would get an opportunity attack if the token moves to the destination. */
export function getOpportunityAttackReactors(
  token: CombatToken,
  destination: GridPosition,
  state: CombatState,
  disengageUsed: boolean
): CombatToken[] {
  if (disengageUsed || !token.placed) return [];

  const engagedBefore = getEngagedHostileTokens(token, state);
  if (engagedBefore.length === 0) return [];

  const atDestination = tokenAtPosition(token, destination.x, destination.y);
  const engagedAfter = getEngagedHostileTokens(atDestination, state);
  const stillEngagedIds = new Set(engagedAfter.map((reactor) => reactor.id));

  return engagedBefore.filter((reactor) => !stillEngagedIds.has(reactor.id));
}

/** @deprecated Use getOpportunityAttackReactors */
export const getOpportunityAttackEnemies = getOpportunityAttackReactors;

export function getPartyOpportunityAttackReactors(reactors: CombatToken[]): CombatToken[] {
  return reactors.filter((token) => token.kind === "party");
}
