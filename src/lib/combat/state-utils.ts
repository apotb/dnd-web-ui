import type { ParsedCharacter } from "@/lib/character/utils";
import { registerBattleParticipants } from "@/lib/combat/battle-participants";
import { isCharacterPlaceholder } from "@/lib/combat/character-placeholder";
import { isFootprintOnBlocked } from "@/lib/combat/collision";
import { buildTurnOrder, syncInitiativeOrder } from "@/lib/combat/initiative";
import { adjustTurnAfterTokenRemoved } from "@/lib/combat/turn";
import { getPartyTokenLabel } from "@/lib/combat/party-token-label";
import { getAllyMaxHp } from "@/lib/dnd/party-allies";
import type { PartyAlly } from "@/lib/schemas/party";
import type { EnemyData } from "@/lib/schemas/enemy";
import { DEFAULT_GRID_SIZE, DEFAULT_TILE_FEET, MAX_GRID_SIZE, MAX_TILE_FEET, MIN_GRID_SIZE, MIN_TILE_FEET } from "@/lib/schemas/combat-grid";
import {
  DEFAULT_BOARD_TITLE,
  DEFAULT_COMBAT_TURN,
  type CombatState,
  type CombatToken,
  combatTokenSchema,
  isCombatantToken,
} from "@/lib/schemas/combat-state";
import { TURN_RESET_FIELDS } from "@/lib/combat/turn";

export interface EnemyRecord {
  slug: string;
  name: string;
  data: EnemyData;
}

export function relabelEnemyTokens(tokens: CombatToken[]): CombatToken[] {
  const groups = new Map<string, CombatToken[]>();

  for (const token of tokens) {
    if (token.kind !== "enemy" || !token.enemySlug) continue;
    const group = groups.get(token.enemySlug) ?? [];
    group.push(token);
    groups.set(token.enemySlug, group);
  }

  return tokens.map((token) => {
    if (token.kind !== "enemy" || !token.enemySlug) return token;

    const group = groups.get(token.enemySlug) ?? [token];
    if (group.length === 1) {
      return { ...token, label: token.name };
    }

    const index = group.findIndex((entry) => entry.id === token.id);
    return {
      ...token,
      label: `${token.name} ${String.fromCharCode(65 + index)}`,
    };
  });
}

export function buildPartyTokens(
  characters: ParsedCharacter[],
  state: CombatState
): CombatToken[] {
  const sorted = [...characters].sort((a, b) => a.name.localeCompare(b.name));
  let workingState: CombatState = { ...state, tokens: [...state.tokens] };
  const partyTokens: CombatToken[] = [];

  for (const character of sorted) {
    const width = 1;
    const height = 1;
    const { x, y } = findPartySpawnSlot(workingState, width, height);
    const token = combatTokenSchema.parse({
      id: character.id,
      kind: "party",
      name: character.name,
      label: getPartyTokenLabel(character.name),
      characterId: character.id,
      portraitPath: character.data.basicInfo.portrait || null,
      x,
      y,
      width,
      height,
      placed: true,
    });
    partyTokens.push(token);
    workingState = { ...workingState, tokens: [...workingState.tokens, token] };
  }

  return partyTokens;
}

export function createDefaultCombatState(
  characters: ParsedCharacter[] = []
): CombatState {
  const base: CombatState = {
    gridWidth: DEFAULT_GRID_SIZE,
    gridHeight: DEFAULT_GRID_SIZE,
    tileFeet: DEFAULT_TILE_FEET,
    backgroundPath: null,
    blockedCells: [],
    tokens: [],
    excludedPartyCharacterIds: [],
    excludedAllyIds: [],
    initiative: { status: "none", results: {}, order: [] },
    turn: DEFAULT_COMBAT_TURN,
    pendingAttacks: [],
    pendingOpportunityAttacks: null,
    boardTitle: DEFAULT_BOARD_TITLE,
    savedEncounterId: null,
    autoApprove: false,
    autoApproveDm: true,
    xpPool: 0,
    battleParticipantCharacterIds: [],
    battleAmmoPrepared: false,
    reactionUsedTokenIds: [],
  };

  return {
    ...base,
    tokens: buildPartyTokens(characters, base),
    battleParticipantCharacterIds: characters.map((character) => character.id),
  };
}

export function clampTokenToGrid(token: CombatToken, state: CombatState): CombatToken {
  const maxX = Math.max(0, state.gridWidth - token.width);
  const maxY = Math.max(0, state.gridHeight - token.height);
  return {
    ...token,
    x: Math.min(Math.max(0, token.x), maxX),
    y: Math.min(Math.max(0, token.y), maxY),
  };
}

type TokenFootprint = Pick<CombatToken, "x" | "y" | "width" | "height">;

export function tokenFootprintsOverlap(a: TokenFootprint, b: TokenFootprint): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function tokenOverlapsPlaced(
  token: TokenFootprint & Pick<CombatToken, "id" | "placed">,
  state: CombatState,
  options?: { excludeId?: string }
): boolean {
  if (!token.placed) return false;

  const excludeId = options?.excludeId ?? token.id;

  for (const other of state.tokens) {
    if (other.id === excludeId || !other.placed) continue;
    if (tokenFootprintsOverlap(token, other)) return true;
  }

  return false;
}

function footprintIsFree(
  state: CombatState,
  x: number,
  y: number,
  width: number,
  height: number,
  excludeId = "__probe__"
): boolean {
  const probe = {
    id: excludeId,
    x,
    y,
    width,
    height,
    placed: true,
  } as CombatToken;

  return !tokenOverlapsPlaced(probe, state, { excludeId });
}

function isTileEmpty(state: CombatState, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= state.gridWidth || y >= state.gridHeight) {
    return false;
  }

  for (const token of state.tokens) {
    if (!token.placed) continue;
    if (
      x >= token.x &&
      x < token.x + token.width &&
      y >= token.y &&
      y < token.y + token.height
    ) {
      return false;
    }
  }

  return true;
}

function hasSpawnSideClearance(
  state: CombatState,
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  for (let row = y; row < y + height; row++) {
    const leftClear = x === 0 || isTileEmpty(state, x - 1, row);
    const rightClear = x + width >= state.gridWidth || isTileEmpty(state, x + width, row);

    if (!leftClear || !rightClear) {
      return false;
    }
  }

  return true;
}

/** Edge spawn slots: 1st, 3rd, 5th row (y = 0, 2, 4…), then remaining rows. */
function edgeSpawnRowOrder(state: CombatState, height: number): number[] {
  const maxY = state.gridHeight - height;
  const evenRows: number[] = [];
  const oddRows: number[] = [];

  for (let y = 0; y <= maxY; y++) {
    if (y % 2 === 0) {
      evenRows.push(y);
    } else {
      oddRows.push(y);
    }
  }

  return [...evenRows, ...oddRows];
}

function findEdgeSpawnSlot(
  state: CombatState,
  x: number,
  width: number,
  height: number
): { x: number; y: number } {
  for (const y of edgeSpawnRowOrder(state, height)) {
    if (
      footprintIsFree(state, x, y, width, height) &&
      hasSpawnSideClearance(state, x, y, width, height)
    ) {
      return { x, y };
    }
  }

  for (let y = 0; y <= state.gridHeight - height; y++) {
    if (footprintIsFree(state, x, y, width, height)) {
      return { x, y };
    }
  }

  return { x, y: Math.max(0, state.gridHeight - height) };
}

export function findPartySpawnSlot(
  state: CombatState,
  width: number,
  height: number
): { x: number; y: number } {
  return findEdgeSpawnSlot(state, 0, width, height);
}

export function findEnemySpawnSlot(
  state: CombatState,
  width: number,
  height: number
): { x: number; y: number } {
  const x = Math.max(0, state.gridWidth - width);
  return findEdgeSpawnSlot(state, x, width, height);
}

/** Bottom-left spawn slots: bottom row, then 3rd from bottom, 5th, etc. */
function bottomEdgeSpawnRowOrder(state: CombatState, height: number): number[] {
  const maxY = state.gridHeight - height;
  const evenRows: number[] = [];
  const oddRows: number[] = [];

  for (let y = maxY; y >= 0; y--) {
    const fromBottom = maxY - y;
    if (fromBottom % 2 === 0) {
      evenRows.push(y);
    } else {
      oddRows.push(y);
    }
  }

  return [...evenRows, ...oddRows];
}

function findBottomLeftSpawnSlot(
  state: CombatState,
  width: number,
  height: number
): { x: number; y: number } {
  const x = 0;

  for (const y of bottomEdgeSpawnRowOrder(state, height)) {
    if (
      footprintIsFree(state, x, y, width, height) &&
      hasSpawnSideClearance(state, x, y, width, height)
    ) {
      return { x, y };
    }
  }

  for (let y = state.gridHeight - height; y >= 0; y--) {
    if (footprintIsFree(state, x, y, width, height)) {
      return { x, y };
    }
  }

  return { x, y: Math.max(0, state.gridHeight - height) };
}

export function findMarkerSpawnSlot(
  state: CombatState,
  width: number,
  height: number
): { x: number; y: number } {
  return findBottomLeftSpawnSlot(state, width, height);
}

function tokenFootprintCenter(token: TokenFootprint): { x: number; y: number } {
  return {
    x: token.x + token.width / 2,
    y: token.y + token.height / 2,
  };
}

function adjacentCellsAroundFootprint(
  footprint: TokenFootprint,
  state: CombatState
): Array<{ x: number; y: number }> {
  const minX = footprint.x - 1;
  const maxX = footprint.x + footprint.width;
  const minY = footprint.y - 1;
  const maxY = footprint.y + footprint.height;
  const cells: Array<{ x: number; y: number }> = [];
  const seen = new Set<string>();

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (x < 0 || y < 0 || x >= state.gridWidth || y >= state.gridHeight) continue;
      const insideFootprint =
        x >= footprint.x &&
        x < footprint.x + footprint.width &&
        y >= footprint.y &&
        y < footprint.y + footprint.height;
      if (insideFootprint) continue;

      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cells.push({ x, y });
    }
  }

  return cells;
}

function isMarkerSpawnValid(
  state: CombatState,
  x: number,
  y: number,
  width: number,
  height: number
): boolean {
  if (x < 0 || y < 0 || x + width > state.gridWidth || y + height > state.gridHeight) {
    return false;
  }
  if (isFootprintOnBlocked(state, x, y, width, height)) {
    return false;
  }
  return footprintIsFree(state, x, y, width, height);
}

function scoreThrownWeaponLandingCell(
  cell: { x: number; y: number },
  attackerCenter: { x: number; y: number },
  targetCenter: { x: number; y: number }
): number {
  const approachX = attackerCenter.x - targetCenter.x;
  const approachY = attackerCenter.y - targetCenter.y;
  const length = Math.hypot(approachX, approachY);
  if (length === 0) return 0;

  const nx = approachX / length;
  const ny = approachY / length;
  const vx = cell.x + 0.5 - targetCenter.x;
  const vy = cell.y + 0.5 - targetCenter.y;
  return vx * nx + vy * ny;
}

function rankThrownWeaponLandingCells(
  cells: Array<{ x: number; y: number }>,
  attackerCenter: { x: number; y: number },
  targetCenter: { x: number; y: number }
): Array<{ x: number; y: number }> {
  return [...cells].sort((a, b) => {
    const scoreA = scoreThrownWeaponLandingCell(a, attackerCenter, targetCenter);
    const scoreB = scoreThrownWeaponLandingCell(b, attackerCenter, targetCenter);
    if (scoreB !== scoreA) return scoreB - scoreA;

    const distA = Math.hypot(a.x + 0.5 - attackerCenter.x, a.y + 0.5 - attackerCenter.y);
    const distB = Math.hypot(b.x + 0.5 - attackerCenter.x, b.y + 0.5 - attackerCenter.y);
    return distA - distB;
  });
}

export function findThrownWeaponMarkerSlot(
  state: CombatState,
  attacker: CombatToken,
  target: CombatToken,
  width: number,
  height: number
): { x: number; y: number } {
  const attackerCenter = tokenFootprintCenter(attacker);
  const targetCenter = tokenFootprintCenter(target);

  const adjacentCandidates = adjacentCellsAroundFootprint(target, state).filter((cell) =>
    isMarkerSpawnValid(state, cell.x, cell.y, width, height)
  );
  const rankedAdjacent = rankThrownWeaponLandingCells(
    adjacentCandidates,
    attackerCenter,
    targetCenter
  );
  if (rankedAdjacent.length > 0) {
    return rankedAdjacent[0];
  }

  const fallbackCandidates: Array<{ x: number; y: number }> = [];
  for (let y = 0; y <= state.gridHeight - height; y++) {
    for (let x = 0; x <= state.gridWidth - width; x++) {
      const overlapsTarget =
        x < target.x + target.width &&
        x + width > target.x &&
        y < target.y + target.height &&
        y + height > target.y;
      if (overlapsTarget) continue;
      if (!isMarkerSpawnValid(state, x, y, width, height)) continue;
      fallbackCandidates.push({ x, y });
    }
  }

  const rankedFallback = rankThrownWeaponLandingCells(
    fallbackCandidates,
    attackerCenter,
    targetCenter
  );
  if (rankedFallback.length > 0) {
    return rankedFallback[0];
  }

  return findMarkerSpawnSlot(state, width, height);
}

export function createMarkerToken(
  name: string,
  tooltip: string,
  state: CombatState,
  options?: {
    id?: string;
    portraitPath?: string | null;
    hasCollision?: boolean;
    droppedByCharacterId?: string;
    droppedItemId?: string;
    droppedInventoryItemId?: string;
    isObject?: boolean;
    itemPickup?: boolean;
    pickupItemId?: string;
    pickupQuantity?: number;
  }
): CombatToken {
  const width = 1;
  const height = 1;
  const { x, y } = findMarkerSpawnSlot(state, width, height);
  const trimmedName = name.trim();

  return combatTokenSchema.parse({
    id: options?.id ?? crypto.randomUUID(),
    kind: "marker",
    name: trimmedName,
    label: trimmedName,
    tooltip: tooltip.trim(),
    portraitPath: options?.portraitPath ?? null,
    droppedByCharacterId: options?.droppedByCharacterId,
    droppedItemId: options?.droppedItemId,
    droppedInventoryItemId: options?.droppedInventoryItemId,
    isObject: options?.isObject ?? false,
    itemPickup: options?.itemPickup ?? false,
    pickupItemId: options?.pickupItemId,
    pickupQuantity: options?.pickupQuantity ?? 1,
    x,
    y,
    width,
    height,
    placed: true,
    hasCollision: options?.hasCollision ?? false,
  });
}

export function createThrownWeaponMarker(
  itemName: string,
  thrownByLabel: string,
  state: CombatState,
  options: {
    droppedByCharacterId: string;
    droppedItemId: string;
    droppedInventoryItemId: string;
    attacker: CombatToken;
    target: CombatToken;
    slot?: { x: number; y: number };
  }
): CombatToken {
  const width = 1;
  const height = 1;
  const { x, y } =
    options.slot ??
    findThrownWeaponMarkerSlot(state, options.attacker, options.target, width, height);
  const trimmedName = itemName.trim();

  return combatTokenSchema.parse({
    id: crypto.randomUUID(),
    kind: "marker",
    name: trimmedName,
    label: trimmedName,
    tooltip: `Thrown by ${thrownByLabel}`.trim(),
    droppedByCharacterId: options.droppedByCharacterId,
    droppedItemId: options.droppedItemId,
    droppedInventoryItemId: options.droppedInventoryItemId,
    isObject: true,
    itemPickup: true,
    pickupItemId: options.droppedItemId,
    pickupQuantity: 1,
    x,
    y,
    width,
    height,
    placed: true,
    hasCollision: false,
  });
}

function isAmmoPickupMarker(token: CombatToken): boolean {
  return (
    token.kind === "marker" &&
    token.isObject === true &&
    token.itemPickup === true &&
    Boolean(token.pickupItemId?.trim())
  );
}

function chebyshevCellDistance(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function formatPickupMarkerStackLabel(baseName: string, quantity: number): string {
  const trimmed = baseName.trim();
  if (quantity <= 1) return trimmed;
  return `${trimmed} x${quantity}`;
}

export function findNearbyAmmoPickupMarker(
  state: CombatState,
  cell: { x: number; y: number },
  pickupItemId: string
): CombatToken | null {
  const normalizedId = pickupItemId.trim();
  const candidates = state.tokens.filter(
    (token) =>
      isAmmoPickupMarker(token) &&
      token.placed &&
      token.pickupItemId?.trim() === normalizedId &&
      chebyshevCellDistance(cell, token) <= 1
  );

  if (candidates.length === 0) return null;

  return [...candidates].sort(
    (a, b) => chebyshevCellDistance(cell, a) - chebyshevCellDistance(cell, b)
  )[0];
}

export function mergeAmmoPickupMarker(
  existing: CombatToken,
  options: {
    shooterCharacterId: string;
    shooterName: string;
    baseName: string;
  }
): CombatToken {
  const quantity = Math.max(1, existing.pickupQuantity ?? 1) + 1;
  const label = formatPickupMarkerStackLabel(options.baseName, quantity);

  const existingOwner = existing.droppedByCharacterId?.trim();
  const newOwner = options.shooterCharacterId.trim();
  let tooltip = "";
  if (existing.tooltip?.trim()) {
    if (!existingOwner || !newOwner || existingOwner === newOwner) {
      tooltip = existing.tooltip;
    }
  }

  return {
    ...existing,
    name: label,
    label,
    pickupQuantity: quantity,
    tooltip,
    droppedByCharacterId: existing.droppedByCharacterId ?? options.shooterCharacterId,
  };
}

export function createAmmoPickupMarker(
  itemName: string,
  shotByLabel: string,
  state: CombatState,
  options: {
    droppedByCharacterId: string;
    pickupItemId: string;
    attacker: CombatToken;
    target: CombatToken;
    slot?: { x: number; y: number };
  }
): CombatToken {
  const width = 1;
  const height = 1;
  const { x, y } =
    options.slot ??
    findThrownWeaponMarkerSlot(state, options.attacker, options.target, width, height);
  const trimmedName = itemName.trim();

  return combatTokenSchema.parse({
    id: crypto.randomUUID(),
    kind: "marker",
    name: trimmedName,
    label: trimmedName,
    tooltip: `Shot by ${shotByLabel}`.trim(),
    droppedByCharacterId: options.droppedByCharacterId,
    droppedItemId: options.pickupItemId,
    isObject: true,
    itemPickup: true,
    pickupItemId: options.pickupItemId,
    pickupQuantity: 1,
    x,
    y,
    width,
    height,
    placed: true,
    hasCollision: false,
  });
}

export function placeAmmoPickupMarker(
  state: CombatState,
  attacker: CombatToken,
  target: CombatToken,
  options: {
    pickupItemId: string;
    baseName: string;
    shooterCharacterId: string;
    shooterName: string;
  }
): CombatToken[] {
  const width = 1;
  const height = 1;
  const slot = findThrownWeaponMarkerSlot(state, attacker, target, width, height);
  const existing = findNearbyAmmoPickupMarker(state, slot, options.pickupItemId);

  if (existing) {
    return state.tokens.map((token) =>
      token.id === existing.id
        ? mergeAmmoPickupMarker(token, {
            shooterCharacterId: options.shooterCharacterId,
            shooterName: options.shooterName,
            baseName: options.baseName,
          })
        : token
    );
  }

  const marker = createAmmoPickupMarker(options.baseName, options.shooterName, state, {
    droppedByCharacterId: options.shooterCharacterId,
    pickupItemId: options.pickupItemId,
    attacker,
    target,
    slot,
  });

  return [...state.tokens, marker];
}

export function placeThrownWeaponPickupMarker(
  state: CombatState,
  attacker: CombatToken,
  target: CombatToken,
  options: {
    pickupItemId: string;
    baseName: string;
    thrownByCharacterId: string;
    thrownByName: string;
    droppedInventoryItemId: string;
  }
): CombatToken[] {
  const width = 1;
  const height = 1;
  const slot = findThrownWeaponMarkerSlot(state, attacker, target, width, height);
  const existing = findNearbyAmmoPickupMarker(state, slot, options.pickupItemId);

  if (existing) {
    return state.tokens.map((token) =>
      token.id === existing.id
        ? mergeAmmoPickupMarker(token, {
            shooterCharacterId: options.thrownByCharacterId,
            shooterName: options.thrownByName,
            baseName: options.baseName,
          })
        : token
    );
  }

  const marker = createThrownWeaponMarker(options.baseName, options.thrownByName, state, {
    droppedByCharacterId: options.thrownByCharacterId,
    droppedItemId: options.pickupItemId,
    droppedInventoryItemId: options.droppedInventoryItemId,
    attacker,
    target,
    slot,
  });

  return [...state.tokens, marker];
}

export function createEnemyToken(enemy: EnemyRecord, state: CombatState): CombatToken {
  const width = 1;
  const height = 1;
  const { x, y } = findEnemySpawnSlot(state, width, height);

  return combatTokenSchema.parse({
    id: crypto.randomUUID(),
    kind: "enemy",
    name: enemy.name,
    label: enemy.name,
    enemySlug: enemy.slug,
    portraitPath: enemy.data.portraitPath || null,
    x,
    y,
    width,
    height,
    placed: true,
    currentHp: enemy.data.hitPoints.average,
    maxHp: enemy.data.hitPoints.average,
  });
}

export function normalizeCombatTokens(state: CombatState): CombatState {
  let next = state;

  for (const token of state.tokens) {
    if (token.kind !== "enemy" || token.placed) continue;

    const { x, y } = findEnemySpawnSlot(next, token.width, token.height);
    next = {
      ...next,
      tokens: next.tokens.map((entry) =>
        entry.id === token.id
          ? clampTokenToGrid({ ...entry, x, y, placed: true }, next)
          : entry
      ),
    };
  }

  return next;
}

export function normalizeCombatState(state: CombatState): CombatState {
  return syncInitiativeOrder(normalizeCombatTokens(state));
}

export function resolveTokenEnemyData(
  token: CombatToken,
  enemiesBySlug: Record<string, { data: EnemyData }>,
  alliesById: Record<string, PartyAlly>
): EnemyData | null {
  if (token.kind === "enemy" && token.enemySlug) {
    return enemiesBySlug[token.enemySlug]?.data ?? null;
  }
  if (token.kind === "ally" && token.allyId) {
    return alliesById[token.allyId]?.data ?? null;
  }
  return null;
}

export function createAllyToken(ally: PartyAlly, state: CombatState): CombatToken {
  const width = 1;
  const height = 1;
  const { x, y } = findPartySpawnSlot(state, width, height);
  const maxHp = getAllyMaxHp(ally);

  return combatTokenSchema.parse({
    id: crypto.randomUUID(),
    kind: "ally",
    name: ally.name,
    label: getPartyTokenLabel(ally.name),
    allyId: ally.id,
    portraitPath: ally.data.portraitPath || null,
    x,
    y,
    width,
    height,
    placed: true,
    currentHp: ally.currentHp,
    maxHp,
  });
}

export function addAlliesToState(state: CombatState, allies: PartyAlly[]): CombatState {
  if (allies.length === 0) return state;

  const excluded = new Set(state.excludedAllyIds);
  for (const ally of allies) {
    excluded.delete(ally.id);
  }

  let workingState: CombatState = {
    ...state,
    excludedAllyIds: [...excluded],
    tokens: [...state.tokens],
  };

  for (const ally of allies) {
    const alreadyOnBoard = workingState.tokens.some(
      (token) => token.kind === "ally" && token.allyId === ally.id
    );
    if (alreadyOnBoard) continue;

    const token = createAllyToken(ally, workingState);
    workingState = {
      ...workingState,
      tokens: [...workingState.tokens, token],
    };
  }

  return {
    ...workingState,
    tokens: relabelEnemyTokens(workingState.tokens),
  };
}

export function addEnemyToState(state: CombatState, enemy: EnemyRecord): CombatState {
  return {
    ...state,
    tokens: relabelEnemyTokens([...state.tokens, createEnemyToken(enemy, state)]),
  };
}

export function addMarkerToState(
  state: CombatState,
  name: string,
  tooltip: string,
  options?: {
    id?: string;
    portraitPath?: string | null;
    hasCollision?: boolean;
    isObject?: boolean;
    itemPickup?: boolean;
    pickupItemId?: string;
    pickupQuantity?: number;
  }
): CombatState {
  return {
    ...state,
    tokens: [...state.tokens, createMarkerToken(name, tooltip, state, options)],
  };
}

export function removeTokenFromState(state: CombatState, tokenId: string): CombatState {
  const token = state.tokens.find((entry) => entry.id === tokenId);
  if (!token) return state;

  let excludedPartyCharacterIds = state.excludedPartyCharacterIds;
  let excludedAllyIds = state.excludedAllyIds;
  if (token.kind === "party" && token.characterId) {
    if (!excludedPartyCharacterIds.includes(token.characterId)) {
      excludedPartyCharacterIds = [...excludedPartyCharacterIds, token.characterId];
    }
  }
  if (token.kind === "ally" && token.allyId) {
    if (!excludedAllyIds.includes(token.allyId)) {
      excludedAllyIds = [...excludedAllyIds, token.allyId];
    }
  }

  const tokens = relabelEnemyTokens(state.tokens.filter((entry) => entry.id !== tokenId));
  const { initiative, turn } = clearTokenFromInitiative(
    state.initiative,
    tokenId,
    tokens,
    state.turn
  );

  return {
    ...state,
    excludedPartyCharacterIds,
    excludedAllyIds,
    tokens,
    initiative,
    turn,
  };
}

export function removeEnemyFromState(state: CombatState, tokenId: string): CombatState {
  return removeTokenFromState(state, tokenId);
}

function clearTokenFromInitiative(
  initiative: CombatState["initiative"],
  tokenId: string,
  tokens: CombatToken[],
  turn: CombatState["turn"]
): { initiative: CombatState["initiative"]; turn: CombatState["turn"] } {
  if (initiative.status === "none") {
    return {
      initiative,
      turn: DEFAULT_COMBAT_TURN,
    };
  }

  const { [tokenId]: _removed, ...results } = initiative.results;
  const order = initiative.order.filter((id) => id !== tokenId);

  if (order.length === 0) {
    return {
      initiative: { status: "none", results: {}, order: [] },
      turn: { active: false, index: 0, round: turn.round, ...TURN_RESET_FIELDS },
    };
  }

  if (initiative.status === "ready") {
    return {
      initiative: {
        status: "ready",
        results,
        order,
      },
      turn: adjustTurnAfterTokenRemoved(turn, tokenId, initiative.order),
    };
  }

  const combatants = tokens.filter(isCombatantToken);
  const allCollected =
    combatants.length > 0 &&
    combatants.every((token) => results[token.id] != null);
  if (allCollected) {
    return {
      initiative: {
        status: "ready",
        results,
        order: buildTurnOrder(tokens, results),
      },
      turn: { active: true, index: 0, round: 1, ...TURN_RESET_FIELDS },
    };
  }

  return {
    initiative: {
      status: "collecting",
      results,
      order: [],
    },
    turn: DEFAULT_COMBAT_TURN,
  };
}

export function addPartyMembersToState(
  state: CombatState,
  characters: ParsedCharacter[]
): CombatState {
  if (characters.length === 0) return state;

  const excluded = new Set(state.excludedPartyCharacterIds);
  for (const character of characters) {
    excluded.delete(character.id);
  }

  let workingState: CombatState = {
    ...state,
    excludedPartyCharacterIds: [...excluded],
    tokens: [...state.tokens],
  };
  const addedTokens: CombatToken[] = [];

  for (const character of characters) {
    const alreadyOnBoard = workingState.tokens.some(
      (token) => token.kind === "party" && token.characterId === character.id
    );
    if (alreadyOnBoard) continue;

    const width = 1;
    const height = 1;
    const { x, y } = findPartySpawnSlot(workingState, width, height);
    const token = combatTokenSchema.parse({
      id: character.id,
      kind: "party",
      name: character.name,
      label: getPartyTokenLabel(character.name),
      characterId: character.id,
      portraitPath: character.data.basicInfo.portrait || null,
      x,
      y,
      width,
      height,
      placed: true,
    });
    addedTokens.push(token);
    workingState = {
      ...workingState,
      tokens: [...workingState.tokens, token],
    };
  }

  return registerBattleParticipants(
    {
      ...workingState,
      tokens: relabelEnemyTokens(workingState.tokens),
    },
    characters.map((character) => character.id)
  );
}

export function resetCombatBoard(
  state: CombatState,
  characters: ParsedCharacter[]
): CombatState {
  return {
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
    tileFeet: state.tileFeet,
    backgroundPath: state.backgroundPath ?? null,
    blockedCells: state.blockedCells ?? [],
    tokens: [],
    excludedPartyCharacterIds: characters.map((character) => character.id),
    excludedAllyIds: [],
    initiative: { status: "none", results: {}, order: [] },
    turn: DEFAULT_COMBAT_TURN,
    pendingAttacks: [],
    pendingOpportunityAttacks: null,
    boardTitle: DEFAULT_BOARD_TITLE,
    savedEncounterId: null,
    autoApprove: false,
    autoApproveDm: true,
    xpPool: 0,
    battleParticipantCharacterIds: [],
    battleAmmoPrepared: false,
    reactionUsedTokenIds: [],
  };
}

export function clearEnemiesFromState(
  state: CombatState,
  characters: ParsedCharacter[]
): CombatState {
  return resetCombatBoard(state, characters);
}

export function syncPartyTokens(
  state: CombatState,
  characters: ParsedCharacter[]
): CombatState {
  const placeholders = state.tokens.filter(isCharacterPlaceholder);
  const hasPlaceholders = placeholders.length > 0;

  const excluded = new Set(state.excludedPartyCharacterIds);
  const existingParty = new Map(
    state.tokens
      .filter((token) => token.kind === "party" && token.characterId)
      .map((token) => [token.characterId!, token])
  );
  const nonParty = state.tokens.filter((token) => token.kind !== "party");
  const sorted = [...characters]
    .filter((character) => !excluded.has(character.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  let workingState: CombatState = { ...state, tokens: [...nonParty, ...placeholders] };
  const partyTokens: CombatToken[] = [];

  for (const character of sorted) {
    const existing = existingParty.get(character.id);

    if (existing) {
      const token = clampTokenToGrid(
        {
          ...existing,
          name: character.name,
          label: getPartyTokenLabel(character.name),
          portraitPath: character.data.basicInfo.portrait || existing.portraitPath,
          // Prefer character sheet HP when resyncing roster metadata (e.g. after DM HP adjust).
          currentHp: character.data.combat.currentHp ?? existing.currentHp,
          maxHp: character.data.combat.maxHp ?? existing.maxHp,
        },
        workingState
      );
      partyTokens.push(token);
      workingState = { ...workingState, tokens: [...workingState.tokens, token] };
      continue;
    }

    if (hasPlaceholders) continue;

    const width = 1;
    const height = 1;
    const { x, y } = findPartySpawnSlot(workingState, width, height);
    const token = combatTokenSchema.parse({
      id: character.id,
      kind: "party",
      name: character.name,
      label: getPartyTokenLabel(character.name),
      characterId: character.id,
      portraitPath: character.data.basicInfo.portrait || null,
      x,
      y,
      width,
      height,
      placed: true,
    });
    partyTokens.push(token);
    workingState = { ...workingState, tokens: [...workingState.tokens, token] };
  }

  return {
    ...state,
    tokens: relabelEnemyTokens([...partyTokens, ...placeholders, ...nonParty]),
  };
}

export function updateGridInState(
  state: CombatState,
  patch: Partial<Pick<CombatState, "gridWidth" | "gridHeight" | "tileFeet">>
): CombatState {
  const next = {
    ...state,
    gridWidth: Math.min(
      MAX_GRID_SIZE,
      Math.max(MIN_GRID_SIZE, patch.gridWidth ?? state.gridWidth)
    ),
    gridHeight: Math.min(
      MAX_GRID_SIZE,
      Math.max(MIN_GRID_SIZE, patch.gridHeight ?? state.gridHeight)
    ),
    tileFeet: Math.min(
      MAX_TILE_FEET,
      Math.max(MIN_TILE_FEET, patch.tileFeet ?? state.tileFeet)
    ),
  };

  const dimensionsChanged =
    next.gridWidth !== state.gridWidth || next.gridHeight !== state.gridHeight;

  return {
    ...next,
    blockedCells: dimensionsChanged ? [] : next.blockedCells,
    tokens: next.tokens.map((token) => clampTokenToGrid(token, next)),
  };
}

export function updateTokenInState(
  state: CombatState,
  tokenId: string,
  patch: Partial<CombatToken>
): CombatState {
  const existing = state.tokens.find((token) => token.id === tokenId);
  if (!existing) return state;

  const candidate = clampTokenToGrid(
    {
      ...existing,
      ...patch,
      ...(patch.x != null || patch.y != null ? { placed: true } : {}),
    },
    state
  );

  return {
    ...state,
    tokens: state.tokens.map((token) => (token.id === tokenId ? candidate : token)),
  };
}
