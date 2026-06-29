import type { ParsedCharacter } from "@/lib/character/utils";
import { getCharacterEffectiveSpeedFt } from "@/lib/character/combat-derivation";
import { tokenFootprintsOverlap } from "@/lib/combat/state-utils";
import type { EnemyData } from "@/lib/schemas/enemy";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import type { Item } from "@/lib/schemas/item";
import type { PhbSpecies } from "@/lib/dnd/phb/types";

export interface GridPosition {
  x: number;
  y: number;
}

export interface ReachableDestination extends GridPosition {
  costFeet: number;
  zone: "normal" | "dash";
}

const STEP_DIRECTIONS: GridPosition[] = [
  { x: -1, y: -1 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 1 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

export function parseEnemySpeedFt(speed: string): number {
  const trimmed = speed.trim();
  if (!trimmed) return 30;

  const matches = [...trimmed.matchAll(/(?:(\w+)\s+)?(\d+)\s*ft\.?/gi)];
  if (matches.length === 0) return 30;

  let walkSpeed: number | null = null;
  let maxOtherSpeed = 0;

  for (const match of matches) {
    const label = (match[1] ?? "").toLowerCase();
    const value = Number.parseInt(match[2], 10);
    if (!Number.isFinite(value)) continue;

    if (!label || label === "walk") {
      walkSpeed = walkSpeed == null ? value : Math.max(walkSpeed, value);
      continue;
    }

    if (label !== "hover") {
      maxOtherSpeed = Math.max(maxOtherSpeed, value);
    }
  }

  if (walkSpeed != null && walkSpeed > 0) return walkSpeed;
  if (maxOtherSpeed > 0) return maxOtherSpeed;
  if (walkSpeed != null) return walkSpeed;
  return 30;
}

export interface TokenSpeedOptions {
  catalogItems?: Record<string, Item>;
  speciesList?: PhbSpecies[];
}

export function getTokenSpeedFt(
  token: CombatToken,
  character: ParsedCharacter | null,
  enemyData: EnemyData | null,
  options: TokenSpeedOptions = {}
): number {
  const { catalogItems = {}, speciesList } = options;
  if (token.kind === "party" && character) {
    return getCharacterEffectiveSpeedFt(character.data, catalogItems, speciesList);
  }
  if (token.kind === "enemy" && enemyData) {
    return parseEnemySpeedFt(enemyData.speed);
  }
  if (token.kind === "ally") {
    return 30;
  }
  return 30;
}

function footprintInBounds(
  x: number,
  y: number,
  token: CombatToken,
  state: CombatState
): boolean {
  return (
    x >= 0 &&
    y >= 0 &&
    x + token.width <= state.gridWidth &&
    y + token.height <= state.gridHeight
  );
}

function tokenAtCell(
  state: CombatState,
  x: number,
  y: number,
  excludeId: string
): CombatToken | null {
  for (const other of state.tokens) {
    if (other.id === excludeId || !other.placed) continue;
    if (
      x >= other.x &&
      x < other.x + other.width &&
      y >= other.y &&
      y < other.y + other.height
    ) {
      return other;
    }
  }
  return null;
}

function isAllyForMovement(token: CombatToken): boolean {
  return token.kind === "party" || token.kind === "ally";
}

/** Cells occupied only by allies (or self) can be crossed; enemies block. */
export function canTraverseFootprint(
  x: number,
  y: number,
  movingToken: CombatToken,
  state: CombatState
): boolean {
  if (!footprintInBounds(x, y, movingToken, state)) return false;

  for (let dy = 0; dy < movingToken.height; dy++) {
    for (let dx = 0; dx < movingToken.width; dx++) {
      const cellX = x + dx;
      const cellY = y + dy;
      const occupant = tokenAtCell(state, cellX, cellY, movingToken.id);
      if (!occupant) continue;
      if (occupant.id === movingToken.id) continue;
      if (!isAllyForMovement(occupant)) return false;
    }
  }

  return true;
}

/** Destination must not overlap any other token. */
export function canEndFootprintAt(
  x: number,
  y: number,
  movingToken: CombatToken,
  state: CombatState
): boolean {
  if (!footprintInBounds(x, y, movingToken, state)) return false;

  const probe = {
    ...movingToken,
    x,
    y,
    placed: true,
  };

  for (const other of state.tokens) {
    if (other.id === movingToken.id || !other.placed) continue;
    if (tokenFootprintsOverlap(probe, other)) return false;
  }

  return true;
}

export function getMovementBudgetFeet(
  speedFt: number,
  usedFeet: number,
  dashUsed: boolean,
  actionUsed = false
): { normalRemainingFeet: number; maxRemainingFeet: number } {
  const canExtendWithDash = !dashUsed && !actionUsed;
  const maxTotalFeet = dashUsed ? speedFt * 2 : canExtendWithDash ? speedFt * 2 : speedFt;
  const maxRemainingFeet = Math.max(0, maxTotalFeet - usedFeet);
  const normalRemainingFeet = dashUsed
    ? maxRemainingFeet
    : Math.max(0, speedFt - usedFeet);
  return { normalRemainingFeet, maxRemainingFeet };
}

export function canUseDashMovement(dashUsed: boolean, actionUsed: boolean): boolean {
  return !dashUsed && !actionUsed;
}

export function computeReachableDestinations(
  token: CombatToken,
  state: CombatState,
  options: {
    speedFt: number;
    usedFeet: number;
    dashUsed: boolean;
    actionUsed?: boolean;
  }
): ReachableDestination[] {
  const { speedFt, usedFeet, dashUsed, actionUsed = false } = options;
  const canExtendWithDash = canUseDashMovement(dashUsed, actionUsed);
  const tileFeet = state.tileFeet;
  const { normalRemainingFeet, maxRemainingFeet } = getMovementBudgetFeet(
    speedFt,
    usedFeet,
    dashUsed,
    actionUsed
  );

  if (maxRemainingFeet <= 0) return [];

  const startKey = `${token.x},${token.y}`;
  const costs = new Map<string, number>([[startKey, 0]]);
  const queue: Array<{ x: number; y: number; costFeet: number }> = [
    { x: token.x, y: token.y, costFeet: 0 },
  ];
  const destinations: ReachableDestination[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = `${current.x},${current.y}`;

    if (
      (current.x !== token.x || current.y !== token.y) &&
      canEndFootprintAt(current.x, current.y, token, state)
    ) {
      const zone =
        canExtendWithDash && current.costFeet > normalRemainingFeet ? "dash" : "normal";
      if (current.costFeet <= maxRemainingFeet) {
        destinations.push({
          x: current.x,
          y: current.y,
          costFeet: current.costFeet,
          zone,
        });
      }
    }

    for (const dir of STEP_DIRECTIONS) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;
      const nextKey = `${nx},${ny}`;
      const nextCost = current.costFeet + tileFeet;

      if (nextCost > maxRemainingFeet) continue;
      if (!canTraverseFootprint(nx, ny, token, state)) continue;

      const prev = costs.get(nextKey);
      if (prev != null && prev <= nextCost) continue;

      costs.set(nextKey, nextCost);
      queue.push({ x: nx, y: ny, costFeet: nextCost });
    }
  }

  return destinations;
}

export function findReachableDestination(
  destinations: ReachableDestination[],
  x: number,
  y: number
): ReachableDestination | null {
  return destinations.find((dest) => dest.x === x && dest.y === y) ?? null;
}

export function applyCombatMove(
  state: CombatState,
  tokenId: string,
  destination: GridPosition,
  costFeet: number,
  dashConsumed: boolean
): CombatState {
  return {
    ...state,
    tokens: state.tokens.map((token) =>
      token.id === tokenId ? { ...token, x: destination.x, y: destination.y } : token
    ),
    turn: {
      ...state.turn,
      movementUsedFeet: state.turn.movementUsedFeet + costFeet,
      dashUsed: state.turn.dashUsed || dashConsumed,
      actionUsed: state.turn.actionUsed || dashConsumed,
    },
  };
}

export function findDestinationAtCell(
  destinations: ReachableDestination[],
  token: CombatToken,
  cellX: number,
  cellY: number
): ReachableDestination | null {
  let best: ReachableDestination | null = null;
  for (const dest of destinations) {
    if (
      cellX >= dest.x &&
      cellX < dest.x + token.width &&
      cellY >= dest.y &&
      cellY < dest.y + token.height
    ) {
      if (!best || dest.costFeet < best.costFeet) {
        best = dest;
      }
    }
  }
  return best;
}

export type MovementCellZone = "normal" | "dash";

export function buildMovementCellZones(
  destinations: ReachableDestination[],
  token: CombatToken
): Map<string, MovementCellZone> {
  const zones = new Map<string, MovementCellZone>();
  for (const dest of destinations) {
    for (let dy = 0; dy < token.height; dy++) {
      for (let dx = 0; dx < token.width; dx++) {
        const key = `${dest.x + dx},${dest.y + dy}`;
        const existing = zones.get(key);
        if (existing === "dash") continue;
        if (dest.zone === "dash") {
          zones.set(key, "dash");
        } else if (!existing) {
          zones.set(key, "normal");
        }
      }
    }
  }
  return zones;
}

export function getRemainingMovementFeet(
  speedFt: number,
  usedFeet: number,
  dashUsed: boolean
): number {
  const cap = dashUsed ? speedFt * 2 : speedFt;
  return Math.max(0, cap - usedFeet);
}

export function adjustTurnMovementUsedFeet(
  state: CombatState,
  deltaUsedFeet: number
): CombatState {
  return {
    ...state,
    turn: {
      ...state.turn,
      movementUsedFeet: Math.max(0, state.turn.movementUsedFeet + deltaUsedFeet),
    },
  };
}

export function getDashPreviewRemainingFeet(
  speedFt: number,
  usedFeet: number,
  dashUsed: boolean,
  actionUsed = false
): number | null {
  if (!canUseDashMovement(dashUsed, actionUsed)) return null;
  return Math.max(0, speedFt * 2 - usedFeet);
}
