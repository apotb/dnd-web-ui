import { areTokensWithinMeleeRange, isHostileToken, isTokenEngaged } from "@/lib/combat/engagement";
import { isCellBlocked } from "@/lib/combat/collision";
import type { TokenStatusContext } from "@/lib/combat/feature-effects";
import { isTokenProne } from "@/lib/combat/prone-actions";
import { isMeleeWeaponAttack, type DerivedAttack } from "@/lib/dnd/attacks";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import { isHiddenEnemy } from "@/lib/schemas/combat-state";
import type { GridPosition } from "@/lib/combat/movement";

export type AoeShape = "radius" | "cone" | "cube";

export interface AttackRangeSpec {
  /** Max range in feet (long range when weapon has normal/long bands). */
  maxFt: number;
  /** Range before long-range disadvantage applies. */
  normalRangeFt: number;
  /** Long range limit when weapon has a second range band. */
  longRangeFt?: number;
  /** Whether placement is AoE (click any cell). */
  isAoe: boolean;
  aoeShape?: AoeShape;
  aoeSizeFt?: number;
  /** Some spells must target a creature; others can target any point in range. */
  requiresPrimaryTarget: boolean;
  /** Targets creatures sharing the attacker's occupied cells (Whirlwind, etc.). */
  isSelfSpace?: boolean;
}

export interface TargetingContext {
  attacker: CombatToken;
  state: CombatState;
  attack: DerivedAttack;
}

function tokenCenter(token: CombatToken): { x: number; y: number } {
  return {
    x: token.x + token.width / 2,
    y: token.y + token.height / 2,
  };
}

function cellCenter(cell: GridPosition): { x: number; y: number } {
  return { x: cell.x + 0.5, y: cell.y + 0.5 };
}

/** Minimum Chebyshev distance between two footprints, in grid cells. */
export function footprintChebyshevCells(a: CombatToken, b: CombatToken): number {
  let min = Infinity;
  for (let ay = 0; ay < a.height; ay++) {
    for (let ax = 0; ax < a.width; ax++) {
      for (let by = 0; by < b.height; by++) {
        for (let bx = 0; bx < b.width; bx++) {
          const dx = Math.abs(a.x + ax - (b.x + bx));
          const dy = Math.abs(a.y + ay - (b.y + by));
          min = Math.min(min, Math.max(dx, dy));
        }
      }
    }
  }
  return min;
}

export function distanceFeetBetweenTokens(
  a: CombatToken,
  b: CombatToken,
  tileFeet: number
): number {
  return footprintChebyshevCells(a, b) * tileFeet;
}

export function distanceFeetToCell(
  token: CombatToken,
  cell: GridPosition,
  tileFeet: number
): number {
  let min = Infinity;
  for (let dy = 0; dy < token.height; dy++) {
    for (let dx = 0; dx < token.width; dx++) {
      const tx = token.x + dx;
      const ty = token.y + dy;
      const cheb = Math.max(Math.abs(tx - cell.x), Math.abs(ty - cell.y));
      min = Math.min(min, cheb);
    }
  }
  return min * tileFeet;
}

export function distanceFeetBetweenCells(
  a: GridPosition,
  b: GridPosition,
  tileFeet: number
): number {
  const cheb = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  return cheb * tileFeet;
}

/** Grid cells on a shortest Chebyshev path (diagonals cost 1), inclusive of both endpoints. */
export function chebyshevPathCells(a: GridPosition, b: GridPosition): GridPosition[] {
  const cells: GridPosition[] = [{ x: a.x, y: a.y }];
  if (a.x === b.x && a.y === b.y) return cells;

  let x = a.x;
  let y = a.y;
  const stepX = Math.sign(b.x - a.x);
  const stepY = Math.sign(b.y - a.y);

  while (x !== b.x || y !== b.y) {
    if (x !== b.x) x += stepX;
    if (y !== b.y) y += stepY;
    cells.push({ x, y });
  }

  return cells;
}

export function parseAttackRangeSpec(attack: DerivedAttack): AttackRangeSpec {
  const range = attack.range.trim().toLowerCase();

  const radiusMatch = range.match(/^(\d+)-ft radius$/);
  if (radiusMatch) {
    const size = parseInt(radiusMatch[1], 10);
    return {
      maxFt: size,
      normalRangeFt: size,
      isAoe: true,
      aoeShape: "radius",
      aoeSizeFt: size,
      requiresPrimaryTarget: false,
    };
  }

  const coneMatch = range.match(/^(\d+)-ft cone$/);
  if (coneMatch) {
    const size = parseInt(coneMatch[1], 10);
    return {
      maxFt: size,
      normalRangeFt: size,
      isAoe: true,
      aoeShape: "cone",
      aoeSizeFt: size,
      requiresPrimaryTarget: false,
    };
  }

  const cubeMatch = range.match(/^(\d+)-ft cube$/);
  if (cubeMatch) {
    const size = parseInt(cubeMatch[1], 10);
    return {
      maxFt: size,
      normalRangeFt: size,
      isAoe: true,
      aoeShape: "cube",
      aoeSizeFt: size,
      requiresPrimaryTarget: false,
    };
  }

  if (range === "self-space") {
    return {
      maxFt: 0,
      normalRangeFt: 0,
      isAoe: true,
      isSelfSpace: true,
      requiresPrimaryTarget: false,
    };
  }

  if (range === "touch" || range === "5 ft") {
    return {
      maxFt: 5,
      normalRangeFt: 5,
      isAoe: false,
      requiresPrimaryTarget: true,
    };
  }

  const slashMatch = range.match(/^(\d+)\/(\d+)\s*ft$/);
  if (slashMatch) {
    const normalRangeFt = parseInt(slashMatch[1], 10);
    const longRangeFt = parseInt(slashMatch[2], 10);
    return {
      maxFt: longRangeFt,
      normalRangeFt,
      longRangeFt,
      isAoe: false,
      requiresPrimaryTarget: true,
    };
  }

  const ftMatch = range.match(/^(\d+)\s*(?:ft|feet)$/);
  if (ftMatch) {
    const maxFt = parseInt(ftMatch[1], 10);
    return {
      maxFt,
      normalRangeFt: maxFt,
      isAoe: false,
      requiresPrimaryTarget: true,
    };
  }

  return {
    maxFt: 5,
    normalRangeFt: 5,
    isAoe: false,
    requiresPrimaryTarget: true,
  };
}

export function isAttackAtLongRange(
  attacker: CombatToken,
  target: CombatToken,
  state: CombatState,
  spec: AttackRangeSpec
): boolean {
  if (!spec.longRangeFt || spec.longRangeFt <= spec.normalRangeFt) return false;
  const distance = distanceFeetBetweenTokens(attacker, target, state.tileFeet);
  return distance > spec.normalRangeFt && distance <= spec.longRangeFt;
}

export function isRangedAttackRoll(attack: DerivedAttack): boolean {
  const rollType = attack.rollType ?? "attack";
  if (rollType !== "attack") return false;
  if (isMeleeWeaponAttack(attack)) return false;
  const spec = parseAttackRangeSpec(attack);
  if (spec.isAoe) return false;
  return spec.normalRangeFt > 5;
}

/** Auto-hit attacks with range beyond touch/melee (projectile targeting). */
export function isAutoHitRangedAttack(attack: DerivedAttack): boolean {
  if ((attack.rollType ?? "attack") !== "auto") return false;
  const spec = parseAttackRangeSpec(attack);
  if (spec.isAoe) return false;
  return spec.maxFt > 5;
}

export function usesProjectileLineOfSightTargeting(attack: DerivedAttack): boolean {
  return isRangedAttackRoll(attack) || isAutoHitRangedAttack(attack);
}

export function attackRequiresLineOfSight(attack: DerivedAttack): boolean {
  if (usesProjectileLineOfSightTargeting(attack)) return true;
  if (!isMeleeWeaponAttack(attack)) return false;
  return parseAttackRangeSpec(attack).maxFt > 5;
}

export function hasRangedAttackAdjacentDisadvantage(
  attacker: CombatToken,
  state: CombatState,
  attack: DerivedAttack,
  context?: TokenStatusContext
): boolean {
  return isRangedAttackRoll(attack) && isTokenEngaged(attacker, state, context);
}

function isAttackRoll(attack: DerivedAttack): boolean {
  return (attack.rollType ?? "attack") === "attack";
}

export function hasProneAttackerDisadvantage(
  attacker: CombatToken,
  context?: TokenStatusContext
): boolean {
  return isTokenProne(attacker, context);
}

export function getProneTargetAttackRollModifier(
  attacker: CombatToken,
  target: CombatToken,
  context?: TokenStatusContext
): "advantage" | "disadvantage" | null {
  if (!isTokenProne(target, context)) return null;
  return areTokensWithinMeleeRange(attacker, target) ? "advantage" : "disadvantage";
}

export function getAttackRollAdvantage(
  attacker: CombatToken,
  target: CombatToken,
  state: CombatState,
  attack: DerivedAttack,
  context?: TokenStatusContext
): boolean {
  if (!isAttackRoll(attack)) return false;
  return getProneTargetAttackRollModifier(attacker, target, context) === "advantage";
}

export function getAttackRollDisadvantage(
  attacker: CombatToken,
  target: CombatToken,
  state: CombatState,
  attack: DerivedAttack,
  context?: TokenStatusContext
): boolean {
  if (!isAttackRoll(attack)) return false;
  const spec = parseAttackRangeSpec(attack);
  return (
    isAttackAtLongRange(attacker, target, state, spec) ||
    hasRangedAttackAdjacentDisadvantage(attacker, state, attack, context) ||
    hasProneAttackerDisadvantage(attacker, context) ||
    getProneTargetAttackRollModifier(attacker, target, context) === "disadvantage"
  );
}

export function formatAttackAdvantageLabel(
  attacker: CombatToken,
  target: CombatToken,
  attack: DerivedAttack,
  context?: TokenStatusContext
): string | null {
  if (!isAttackRoll(attack)) return null;
  if (getProneTargetAttackRollModifier(attacker, target, context) === "advantage") {
    return "Prone target within 5 ft (advantage)";
  }
  return null;
}

export function formatAttackDisadvantageLabel(
  attacker: CombatToken,
  target: CombatToken,
  state: CombatState,
  attack: DerivedAttack,
  context?: TokenStatusContext
): string | null {
  if (!isAttackRoll(attack)) return null;
  const spec = parseAttackRangeSpec(attack);
  const longRange = isAttackAtLongRange(attacker, target, state, spec);
  const adjacent = hasRangedAttackAdjacentDisadvantage(attacker, state, attack, context);
  const proneAttacker = hasProneAttackerDisadvantage(attacker, context);
  const proneTargetDistant =
    getProneTargetAttackRollModifier(attacker, target, context) === "disadvantage";

  const reasons: string[] = [];
  if (longRange) reasons.push("long range");
  if (adjacent) reasons.push("adjacent enemy");
  if (proneAttacker) reasons.push("prone attacker");
  if (proneTargetDistant) reasons.push("prone target beyond 5 ft");

  if (reasons.length === 0) return null;
  if (reasons.length === 1) {
    if (longRange) return "Long range (disadvantage)";
    if (adjacent) return "Adjacent enemy (disadvantage)";
    if (proneAttacker) return "Prone (disadvantage on attack rolls)";
    return "Prone target beyond 5 ft (disadvantage)";
  }
  return `Disadvantage (${reasons.join(", ")})`;
}

export function isTokenInAttackRange(
  attacker: CombatToken,
  target: CombatToken,
  state: CombatState,
  spec: AttackRangeSpec
): boolean {
  if (!isTokenOnGrid(attacker, state) || !isTokenOnGrid(target, state)) return false;
  const distance = distanceFeetBetweenTokens(attacker, target, state.tileFeet);
  return distance <= spec.maxFt;
}

export function isTokenOnGrid(token: CombatToken, state: CombatState): boolean {
  if (token.width <= 0 || token.height <= 0) return false;
  return (
    token.x >= 0 &&
    token.y >= 0 &&
    token.x + token.width <= state.gridWidth &&
    token.y + token.height <= state.gridHeight
  );
}

export function getValidHostileTargets(
  attacker: CombatToken,
  state: CombatState,
  maxRangeFt: number
): CombatToken[] {
  if (!isTokenOnGrid(attacker, state)) return [];

  return state.tokens.filter(
    (token) =>
      isTokenOnGrid(token, state) &&
      token.id !== attacker.id &&
      !isHiddenEnemy(token) &&
      isHostileToken(attacker, token) &&
      distanceFeetBetweenTokens(attacker, token, state.tileFeet) <= maxRangeFt
  );
}

export function getTokensSharingSpace(
  attacker: CombatToken,
  state: CombatState,
  filter?: (token: CombatToken) => boolean
): CombatToken[] {
  if (!isTokenOnGrid(attacker, state)) return [];

  const attackerCells: GridPosition[] = [];
  for (let dy = 0; dy < attacker.height; dy++) {
    for (let dx = 0; dx < attacker.width; dx++) {
      attackerCells.push({ x: attacker.x + dx, y: attacker.y + dy });
    }
  }

  return getTokensInCells(attackerCells, state, (token) => {
    if (token.id === attacker.id) return false;
    if (filter && !filter(token)) return false;
    return true;
  });
}

export function getValidHostileTargetsForAttack(
  attacker: CombatToken,
  state: CombatState,
  spec: AttackRangeSpec,
  attack?: DerivedAttack
): CombatToken[] {
  if (spec.isSelfSpace) {
    return getTokensSharingSpace(attacker, state, (token) => !isHiddenEnemy(token));
  }

  const targets = getValidHostileTargets(attacker, state, spec.maxFt);
  if (!attack || !attackRequiresLineOfSight(attack)) return targets;
  return targets.filter((token) => hasLineOfSightToToken(attacker, token, state));
}

export function findHostileTargetAtCell(
  attacker: CombatToken,
  cell: GridPosition,
  state: CombatState,
  attack: DerivedAttack
): CombatToken | null {
  const spec = parseAttackRangeSpec(attack);
  if (spec.isAoe) return null;

  const validIds = new Set(
    getValidHostileTargetsForAttack(attacker, state, spec, attack).map((token) => token.id)
  );

  for (const token of state.tokens) {
    if (!validIds.has(token.id)) continue;
    if (!tokenOccupiesCell(token, cell)) continue;
    return token;
  }

  return null;
}

function cellsInRadius(
  center: GridPosition,
  radiusFt: number,
  tileFeet: number,
  gridWidth: number,
  gridHeight: number
): GridPosition[] {
  const radiusCells = Math.ceil(radiusFt / tileFeet);
  const cells: GridPosition[] = [];
  for (let y = center.y - radiusCells; y <= center.y + radiusCells; y++) {
    for (let x = center.x - radiusCells; x <= center.x + radiusCells; x++) {
      if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) continue;
      const cheb = Math.max(Math.abs(x - center.x), Math.abs(y - center.y));
      if (cheb * tileFeet <= radiusFt) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

function cellsInCube(
  center: GridPosition,
  sizeFt: number,
  tileFeet: number,
  gridWidth: number,
  gridHeight: number
): GridPosition[] {
  const halfCells = Math.ceil(sizeFt / tileFeet / 2);
  const cells: GridPosition[] = [];
  for (let y = center.y - halfCells; y <= center.y + halfCells; y++) {
    for (let x = center.x - halfCells; x <= center.x + halfCells; x++) {
      if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) continue;
      cells.push({ x, y });
    }
  }
  return cells;
}

function cellsInCone(
  origin: { x: number; y: number },
  targetCell: GridPosition,
  lengthFt: number,
  tileFeet: number,
  gridWidth: number,
  gridHeight: number
): GridPosition[] {
  const lengthCells = Math.ceil(lengthFt / tileFeet);
  const dirX = targetCell.x + 0.5 - origin.x;
  const dirY = targetCell.y + 0.5 - origin.y;
  const len = Math.hypot(dirX, dirY) || 1;
  const ux = dirX / len;
  const uy = dirY / len;

  const cells: GridPosition[] = [];
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const cx = x + 0.5 - origin.x;
      const cy = y + 0.5 - origin.y;
      const dist = Math.max(Math.abs(cx), Math.abs(cy));
      if (dist > lengthCells) continue;
      const dot = cx * ux + cy * uy;
      if (dot < 0) continue;
      const perp = Math.abs(cx * uy - cy * ux);
      if (perp <= dist * 0.75 + 0.5) {
        cells.push({ x, y });
      }
    }
  }
  return cells;
}

export function getAoeCells(
  attacker: CombatToken,
  center: GridPosition,
  spec: AttackRangeSpec,
  state: CombatState
): GridPosition[] {
  const tileFeet = state.tileFeet;

  if (!spec.isAoe || !spec.aoeShape || !spec.aoeSizeFt) return [center];

  if (spec.aoeShape === "radius") {
    return cellsInRadius(center, spec.aoeSizeFt, tileFeet, state.gridWidth, state.gridHeight);
  }
  if (spec.aoeShape === "cube") {
    return cellsInCube(center, spec.aoeSizeFt, tileFeet, state.gridWidth, state.gridHeight);
  }
  if (spec.aoeShape === "cone") {
    const origin = tokenCenter(attacker);
    return cellsInCone(
      origin,
      center,
      spec.aoeSizeFt,
      tileFeet,
      state.gridWidth,
      state.gridHeight
    );
  }
  return [center];
}

export function tokenOccupiesCell(token: CombatToken, cell: GridPosition): boolean {
  return (
    cell.x >= token.x &&
    cell.x < token.x + token.width &&
    cell.y >= token.y &&
    cell.y < token.y + token.height
  );
}

export function getTokensInCells(
  cells: GridPosition[],
  state: CombatState,
  filter?: (token: CombatToken) => boolean
): CombatToken[] {
  const cellSet = new Set(cells.map((c) => `${c.x},${c.y}`));
  const seen = new Set<string>();
  const result: CombatToken[] = [];

  for (const token of state.tokens) {
    if (!token.placed || seen.has(token.id)) continue;
    if (filter && !filter(token)) continue;

    let inArea = false;
    for (let dy = 0; dy < token.height && !inArea; dy++) {
      for (let dx = 0; dx < token.width; dx++) {
        if (cellSet.has(`${token.x + dx},${token.y + dy}`)) {
          inArea = true;
          break;
        }
      }
    }
    if (inArea) {
      seen.add(token.id);
      result.push(token);
    }
  }
  return result;
}

export function getPlacableAoeCells(
  attacker: CombatToken,
  state: CombatState,
  spec: AttackRangeSpec
): GridPosition[] {
  if (!isTokenOnGrid(attacker, state)) return [];

  const cells: GridPosition[] = [];
  for (let y = 0; y < state.gridHeight; y++) {
    for (let x = 0; x < state.gridWidth; x++) {
      const cell = { x, y };
      if (distanceFeetToCell(attacker, cell, state.tileFeet) > spec.maxFt) continue;
      if (isCellBlocked(state, x, y)) continue;
      cells.push(cell);
    }
  }
  return cells;
}

export function getTargetingHighlights(
  attacker: CombatToken,
  state: CombatState,
  attack: DerivedAttack
): {
  spec: AttackRangeSpec;
  validTargets: CombatToken[];
  validCells: GridPosition[];
  rangedCellZones?: Map<string, RangedAttackCellZone>;
} {
  const spec = parseAttackRangeSpec(attack);

  if (spec.isAoe) {
    if (spec.isSelfSpace) {
      const validTargets = getValidHostileTargetsForAttack(attacker, state, spec, attack);
      return { spec, validTargets, validCells: [] };
    }
    return {
      spec,
      validTargets: [],
      validCells: getPlacableAoeCells(attacker, state, spec),
    };
  }

  const projectileLos = usesProjectileLineOfSightTargeting(attack);
  const validTargets = getValidHostileTargetsForAttack(attacker, state, spec, attack);
  const validCells: GridPosition[] = [];
  for (const token of validTargets) {
    for (let dy = 0; dy < token.height; dy++) {
      for (let dx = 0; dx < token.width; dx++) {
        const cell = { x: token.x + dx, y: token.y + dy };
        if (isCellBlocked(state, cell.x, cell.y)) continue;
        validCells.push(cell);
      }
    }
  }

  const rangedCellZones = spec.isAoe
    ? undefined
    : projectileLos
      ? isAutoHitRangedAttack(attack)
        ? buildUnlimitedLineOfSightCellZones(attacker, state)
        : buildRangedAttackCellZones(attacker, state, spec)
      : buildMeleeAttackCellZones(attacker, state, spec, attack);

  return {
    spec,
    validTargets,
    validCells,
    rangedCellZones,
  };
}

export function getAoePreviewTargets(
  attacker: CombatToken,
  center: GridPosition,
  state: CombatState,
  attack: DerivedAttack,
  includeAllies: boolean
): CombatToken[] {
  const spec = parseAttackRangeSpec(attack);
  const cells = getAoeCells(attacker, center, spec, state);
  return getTokensInCells(cells, state, (token) => {
    if (token.id === attacker.id) return false;
    if (isHiddenEnemy(token)) return false;
    if (includeAllies) return true;
    return isHostileToken(attacker, token);
  });
}

export function getAttackerOriginCell(attacker: CombatToken): GridPosition {
  const center = tokenCenter(attacker);
  return { x: Math.floor(center.x), y: Math.floor(center.y) };
}

/** Integer Bresenham line between two grid cells (inclusive). */
function getGridLineCells(from: GridPosition, to: GridPosition): GridPosition[] {
  const cells: GridPosition[] = [];
  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    cells.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }

  return cells;
}

function isLineBlockedByWalls(
  state: CombatState,
  from: GridPosition,
  to: GridPosition
): boolean {
  const line = getGridLineCells(from, to);
  for (let i = 1; i < line.length - 1; i++) {
    const cell = line[i];
    if (isCellBlocked(state, cell.x, cell.y)) return true;
  }
  return false;
}

export function hasLineOfSightToCell(
  attacker: CombatToken,
  cell: GridPosition,
  state: CombatState
): boolean {
  if (!isTokenOnGrid(attacker, state)) return false;
  const origin = getAttackerOriginCell(attacker);
  if (origin.x === cell.x && origin.y === cell.y) return true;
  return !isLineBlockedByWalls(state, origin, cell);
}

export function hasLineOfSightToToken(
  attacker: CombatToken,
  target: CombatToken,
  state: CombatState
): boolean {
  if (!isTokenOnGrid(target, state)) return false;
  for (let dy = 0; dy < target.height; dy++) {
    for (let dx = 0; dx < target.width; dx++) {
      if (hasLineOfSightToCell(attacker, { x: target.x + dx, y: target.y + dy }, state)) {
        return true;
      }
    }
  }
  return false;
}

export type RangedAttackCellZone = "normal" | "long";

export function buildRangedAttackCellZones(
  attacker: CombatToken,
  state: CombatState,
  spec: AttackRangeSpec
): Map<string, RangedAttackCellZone> {
  const zones = new Map<string, RangedAttackCellZone>();
  if (!isTokenOnGrid(attacker, state)) return zones;

  const tileFeet = state.tileFeet;
  const hasLongBand =
    spec.longRangeFt != null && spec.longRangeFt > spec.normalRangeFt;

  for (let y = 0; y < state.gridHeight; y++) {
    for (let x = 0; x < state.gridWidth; x++) {
      if (isCellBlocked(state, x, y)) continue;

      const cell = { x, y };
      if (tokenOccupiesCell(attacker, cell)) continue;
      if (!hasLineOfSightToCell(attacker, cell, state)) continue;

      const distanceFt = distanceFeetToCell(attacker, cell, tileFeet);
      if (distanceFt <= spec.normalRangeFt) {
        zones.set(`${x},${y}`, "normal");
      } else if (
        hasLongBand &&
        distanceFt > spec.normalRangeFt &&
        distanceFt <= spec.longRangeFt!
      ) {
        zones.set(`${x},${y}`, "long");
      }
    }
  }

  return zones;
}

/** Every grid cell with line of sight from the attacker (no range cap). */
export function buildUnlimitedLineOfSightCellZones(
  attacker: CombatToken,
  state: CombatState
): Map<string, RangedAttackCellZone> {
  const zones = new Map<string, RangedAttackCellZone>();
  if (!isTokenOnGrid(attacker, state)) return zones;

  for (let y = 0; y < state.gridHeight; y++) {
    for (let x = 0; x < state.gridWidth; x++) {
      if (isCellBlocked(state, x, y)) continue;

      const cell = { x, y };
      if (tokenOccupiesCell(attacker, cell)) continue;
      if (!hasLineOfSightToCell(attacker, cell, state)) continue;

      zones.set(`${x},${y}`, "normal");
    }
  }

  return zones;
}

export function buildMeleeAttackCellZones(
  attacker: CombatToken,
  state: CombatState,
  spec: AttackRangeSpec,
  attack?: DerivedAttack
): Map<string, RangedAttackCellZone> {
  const zones = new Map<string, RangedAttackCellZone>();
  if (!isTokenOnGrid(attacker, state)) return zones;

  const tileFeet = state.tileFeet;
  const requiresLineOfSight = attack != null && attackRequiresLineOfSight(attack);

  for (let y = 0; y < state.gridHeight; y++) {
    for (let x = 0; x < state.gridWidth; x++) {
      if (isCellBlocked(state, x, y)) continue;

      const cell = { x, y };
      if (tokenOccupiesCell(attacker, cell)) continue;
      if (requiresLineOfSight && !hasLineOfSightToCell(attacker, cell, state)) continue;

      const distanceFt = distanceFeetToCell(attacker, cell, tileFeet);
      if (distanceFt <= spec.maxFt) {
        zones.set(`${x},${y}`, "normal");
      }
    }
  }

  return zones;
}

export function isCellInRangeForAoe(
  attacker: CombatToken,
  cell: GridPosition,
  state: CombatState,
  spec: AttackRangeSpec
): boolean {
  if (isCellBlocked(state, cell.x, cell.y)) return false;
  return distanceFeetToCell(attacker, cell, state.tileFeet) <= spec.maxFt;
}

export type VisionDistanceBand = "near" | "mid" | "far" | "extreme";

const VISION_MAX_FT = 120;

function visionBandForDistance(distanceFt: number): VisionDistanceBand | null {
  if (distanceFt <= 30) return "near";
  if (distanceFt <= 60) return "mid";
  if (distanceFt <= 90) return "far";
  if (distanceFt <= VISION_MAX_FT) return "extreme";
  return null;
}

/** Visible cells from an observer, bucketed by distance band (0–120 ft, wall-blocked LOS). */
export function buildVisionCellBands(
  observer: CombatToken,
  state: CombatState
): Map<string, VisionDistanceBand> {
  const bands = new Map<string, VisionDistanceBand>();
  if (!isTokenOnGrid(observer, state)) return bands;

  const tileFeet = state.tileFeet;

  for (let dy = 0; dy < observer.height; dy++) {
    for (let dx = 0; dx < observer.width; dx++) {
      const x = observer.x + dx;
      const y = observer.y + dy;
      if (!isCellBlocked(state, x, y)) {
        bands.set(`${x},${y}`, "near");
      }
    }
  }

  for (let y = 0; y < state.gridHeight; y++) {
    for (let x = 0; x < state.gridWidth; x++) {
      const key = `${x},${y}`;
      if (bands.has(key)) continue;
      if (isCellBlocked(state, x, y)) continue;

      const cell = { x, y };
      if (!hasLineOfSightToCell(observer, cell, state)) continue;

      const distanceFt = distanceFeetToCell(observer, cell, tileFeet);
      const band = visionBandForDistance(distanceFt);
      if (band) bands.set(key, band);
    }
  }

  return bands;
}
