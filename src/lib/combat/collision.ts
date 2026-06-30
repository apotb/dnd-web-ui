import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import { isHiddenEnemy } from "@/lib/schemas/combat-state";

function isFriendlyToken(token: CombatToken): boolean {
  return token.kind === "party" || token.kind === "ally";
}

function isHostileToken(token: CombatToken): boolean {
  return token.kind === "enemy";
}

/** Party, ally, and enemy tokens occupy cells and cannot be movement destinations. */
export function tokenBlocksMovementDestination(token: CombatToken): boolean {
  if (isHiddenEnemy(token)) return false;
  return isFriendlyToken(token) || isHostileToken(token);
}

/** Whether two tokens block each other during movement pathfinding. */
export function tokensCollideForMovement(a: CombatToken, b: CombatToken): boolean {
  if (a.id === b.id) return false;

  if (isHiddenEnemy(a) || isHiddenEnemy(b)) return false;

  if (a.kind === "marker") {
    if (!a.hasCollision) return false;
    return true;
  }
  if (b.kind === "marker") {
    if (!b.hasCollision) return false;
    return true;
  }

  if (isFriendlyToken(a) && isFriendlyToken(b)) return false;
  if (isHostileToken(a) && isHostileToken(b)) return false;
  return true;
}

export type BlockedCell = { x: number; y: number };

export function blockedCellKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function buildBlockedCellSet(cells: BlockedCell[]): Set<string> {
  return new Set(cells.map((cell) => blockedCellKey(cell.x, cell.y)));
}

export function blockedCellsFromSet(set: Set<string>): BlockedCell[] {
  return [...set]
    .map((key) => {
      const [x, y] = key.split(",").map(Number);
      return { x, y };
    })
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

export function areBlockedCellsEqual(a: BlockedCell[], b: BlockedCell[]): boolean {
  if (a.length !== b.length) return false;
  const setA = buildBlockedCellSet(a);
  for (const cell of b) {
    if (!setA.has(blockedCellKey(cell.x, cell.y))) return false;
  }
  return true;
}

export function isCellBlocked(state: CombatState, x: number, y: number): boolean {
  const cells = state.blockedCells ?? [];
  for (const cell of cells) {
    if (cell.x === x && cell.y === y) return true;
  }
  return false;
}

export function isFootprintOnBlocked(
  state: CombatState,
  x: number,
  y: number,
  width: number,
  height: number,
  blocked?: Set<string>
): boolean {
  const set = blocked ?? buildBlockedCellSet(state.blockedCells ?? []);
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      if (set.has(blockedCellKey(x + dx, y + dy))) return true;
    }
  }
  return false;
}

export function cellsInRectangle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  gridWidth: number,
  gridHeight: number
): BlockedCell[] {
  const minX = Math.max(0, Math.min(x1, x2));
  const maxX = Math.min(gridWidth - 1, Math.max(x1, x2));
  const minY = Math.max(0, Math.min(y1, y2));
  const maxY = Math.min(gridHeight - 1, Math.max(y1, y2));
  const cells: BlockedCell[] = [];

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      cells.push({ x, y });
    }
  }

  return cells;
}

export function applyRectangleToBlockedSet(
  draft: Set<string>,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  gridWidth: number,
  gridHeight: number,
  mode: "add" | "remove"
): void {
  for (const { x, y } of cellsInRectangle(x1, y1, x2, y2, gridWidth, gridHeight)) {
    const key = blockedCellKey(x, y);
    if (mode === "add") {
      draft.add(key);
    } else {
      draft.delete(key);
    }
  }
}

export function filterBlockedCellsToGrid(
  cells: BlockedCell[],
  gridWidth: number,
  gridHeight: number
): BlockedCell[] {
  return cells.filter((cell) => cell.x >= 0 && cell.y >= 0 && cell.x < gridWidth && cell.y < gridHeight);
}
