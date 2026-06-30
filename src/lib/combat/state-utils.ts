import type { ParsedCharacter } from "@/lib/character/utils";
import { isCharacterPlaceholder } from "@/lib/combat/character-placeholder";
import { buildTurnOrder } from "@/lib/combat/initiative";
import { adjustTurnAfterTokenRemoved } from "@/lib/combat/turn";
import { getPartyTokenLabel } from "@/lib/combat/party-token-label";
import type { EnemyData } from "@/lib/schemas/enemy";
import { DEFAULT_GRID_SIZE, DEFAULT_TILE_FEET, MAX_GRID_SIZE, MAX_TILE_FEET, MIN_GRID_SIZE, MIN_TILE_FEET } from "@/lib/schemas/combat-grid";
import {
  DEFAULT_BOARD_TITLE,
  type CombatState,
  type CombatToken,
  combatTokenSchema,
  isCombatantToken,
} from "@/lib/schemas/combat-state";

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
    initiative: { status: "none", results: {}, order: [] },
    turn: { active: false, index: 0, round: 1, movementUsedFeet: 0, dashUsed: false, actionUsedForTwoWeapon: false, actionUsed: false, bonusActionUsed: false, disengageUsed: false },
    pendingAttacks: [],
    pendingOpportunityAttacks: null,
    boardTitle: DEFAULT_BOARD_TITLE,
    savedEncounterId: null,
  };

  return {
    ...base,
    tokens: buildPartyTokens(characters, base),
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
  }
): CombatToken {
  return createMarkerToken(itemName, `Thrown by ${thrownByLabel}`, state, options);
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
  options?: { id?: string; portraitPath?: string | null; hasCollision?: boolean }
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
  if (token.kind === "party" && token.characterId) {
    if (!excludedPartyCharacterIds.includes(token.characterId)) {
      excludedPartyCharacterIds = [...excludedPartyCharacterIds, token.characterId];
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
      turn: { active: false, index: 0, round: 1, movementUsedFeet: 0, dashUsed: false, actionUsedForTwoWeapon: false, actionUsed: false, bonusActionUsed: false, disengageUsed: false },
    };
  }

  const { [tokenId]: _removed, ...results } = initiative.results;
  const order = initiative.order.filter((id) => id !== tokenId);

  if (order.length === 0) {
    return {
      initiative: { status: "none", results: {}, order: [] },
      turn: { active: false, index: 0, round: turn.round, movementUsedFeet: 0, dashUsed: false, actionUsedForTwoWeapon: false, actionUsed: false, bonusActionUsed: false, disengageUsed: false },
    };
  }

  if (initiative.status === "ready") {
    return {
      initiative: {
        status: "ready",
        results,
        order,
      },
      turn: adjustTurnAfterTokenRemoved(turn, tokenId, order),
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
      turn: { active: true, index: 0, round: 1, movementUsedFeet: 0, dashUsed: false, actionUsedForTwoWeapon: false, actionUsed: false, bonusActionUsed: false, disengageUsed: false },
    };
  }

  return {
    initiative: {
      status: "collecting",
      results,
      order: [],
    },
    turn: { active: false, index: 0, round: 1, movementUsedFeet: 0, dashUsed: false, actionUsedForTwoWeapon: false, actionUsed: false, bonusActionUsed: false, disengageUsed: false },
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

  return {
    ...workingState,
    tokens: relabelEnemyTokens(workingState.tokens),
  };
}

export function resetCombatBoard(
  state: CombatState,
  characters: ParsedCharacter[]
): CombatState {
  const base: CombatState = {
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
    tileFeet: state.tileFeet,
    backgroundPath: state.backgroundPath ?? null,
    blockedCells: state.blockedCells ?? [],
    tokens: [],
    excludedPartyCharacterIds: [],
    initiative: { status: "none", results: {}, order: [] },
    turn: { active: false, index: 0, round: 1, movementUsedFeet: 0, dashUsed: false, actionUsedForTwoWeapon: false, actionUsed: false, bonusActionUsed: false, disengageUsed: false },
    pendingAttacks: [],
    pendingOpportunityAttacks: null,
    boardTitle: DEFAULT_BOARD_TITLE,
    savedEncounterId: null,
  };

  return {
    ...base,
    tokens: buildPartyTokens(characters, base),
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

  const candidate = clampTokenToGrid({ ...existing, ...patch }, state);

  return {
    ...state,
    tokens: state.tokens.map((token) => (token.id === tokenId ? candidate : token)),
  };
}
