import { createCharacterPlaceholderToken } from "@/lib/combat/character-placeholder";
import { relabelEnemyTokens, type EnemyRecord } from "@/lib/combat/state-utils";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import { combatTokenSchema, DEFAULT_COMBAT_TURN } from "@/lib/schemas/combat-state";
import {
  parseSavedEncounterBlockedCells,
  parseSavedEncounterData,
  type SavedEncounterData,
  type SavedEncounterEnemy,
  type SavedEncounterMarker,
} from "@/lib/schemas/saved-encounter";
import type { Encounter } from "@/lib/types/database";

export type EncounterSort = "name" | "totalCr" | "updatedAt";

export function parseChallengeRatingValue(cr: string): number {
  const trimmed = cr.trim();
  if (!trimmed) return 0;
  if (trimmed.includes("/")) {
    const [numerator, denominator] = trimmed.split("/");
    const num = Number.parseFloat(numerator);
    const den = Number.parseFloat(denominator);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return 0;
    return num / den;
  }
  const value = Number.parseFloat(trimmed);
  return Number.isFinite(value) ? value : 0;
}

export function computeTotalCrForEnemies(
  enemies: SavedEncounterEnemy[],
  enemiesBySlug: Record<string, Pick<EnemyRecord, "data">>
): number {
  let total = 0;
  for (const enemy of enemies) {
    const data = enemiesBySlug[enemy.enemySlug]?.data;
    total += parseChallengeRatingValue(data?.challengeRating ?? "0");
  }
  return total;
}

export function combatStateToEncounterPayload(
  state: CombatState,
  enemiesBySlug: Record<string, Pick<EnemyRecord, "data">>
): {
  backgroundPath: string | null;
  gridWidth: number;
  gridHeight: number;
  tileFeet: number;
  blockedCells: CombatState["blockedCells"];
  data: SavedEncounterData;
  totalCr: number;
} {
  const enemies: SavedEncounterEnemy[] = state.tokens
    .filter((token) => token.kind === "enemy" && token.enemySlug)
    .map((token) => ({
      enemySlug: token.enemySlug!,
      ...(token.displayName?.trim() ? { displayName: token.displayName.trim() } : {}),
      hidden: token.hidden ?? false,
      x: token.x,
      y: token.y,
      width: token.width,
      height: token.height,
    }));

  const markers: SavedEncounterMarker[] = state.tokens
    .filter((token) => token.kind === "marker")
    .map((token) => ({
      name: token.name,
      tooltip: token.tooltip,
      portraitPath: token.portraitPath,
      x: token.x,
      y: token.y,
      width: token.width,
      height: token.height,
      hasCollision: token.hasCollision ?? false,
      isObject: token.isObject ?? false,
      itemPickup: token.itemPickup ?? false,
      ...(token.pickupItemId ? { pickupItemId: token.pickupItemId } : {}),
      pickupQuantity: token.pickupQuantity ?? 1,
    }));

  const characterSlots = state.tokens
    .filter((token) => token.kind === "party")
    .map((token) => ({
      x: token.x,
      y: token.y,
      width: token.width,
      height: token.height,
    }));

  const data: SavedEncounterData = { enemies, markers, characterSlots };

  return {
    backgroundPath: state.backgroundPath ?? null,
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
    tileFeet: state.tileFeet,
    blockedCells: state.blockedCells,
    data,
    totalCr: computeTotalCrForEnemies(enemies, enemiesBySlug),
  };
}

function createEnemyTokenFromSave(
  enemy: EnemyRecord,
  saved: SavedEncounterEnemy
): CombatToken {
  return combatTokenSchema.parse({
    id: crypto.randomUUID(),
    kind: "enemy",
    name: enemy.name,
    label: enemy.name,
    displayName: saved.displayName?.trim() || undefined,
    hidden: saved.hidden ?? false,
    enemySlug: enemy.slug,
    portraitPath: enemy.data.portraitPath || null,
    x: saved.x,
    y: saved.y,
    width: saved.width,
    height: saved.height,
    placed: true,
    currentHp: enemy.data.hitPoints.average,
    maxHp: enemy.data.hitPoints.average,
  });
}

function createMarkerTokenFromSave(saved: SavedEncounterMarker): CombatToken {
  return combatTokenSchema.parse({
    id: crypto.randomUUID(),
    kind: "marker",
    name: saved.name,
    label: saved.name.trim() || "Marker",
    tooltip: saved.tooltip,
    portraitPath: saved.portraitPath,
    x: saved.x,
    y: saved.y,
    width: saved.width,
    height: saved.height,
    placed: true,
    hasCollision: saved.hasCollision ?? false,
    isObject: saved.isObject ?? false,
    itemPickup: saved.itemPickup ?? false,
    pickupItemId: saved.pickupItemId,
    pickupQuantity: saved.pickupQuantity ?? 1,
  });
}

const EMPTY_TURN: CombatState["turn"] = DEFAULT_COMBAT_TURN;

export function savedEncounterToCombatState(
  encounter: Encounter,
  enemiesBySlug: Record<string, EnemyRecord>,
  allCharacterIds: string[]
): CombatState {
  const data = parseSavedEncounterData(encounter.data);
  const blockedCells = parseSavedEncounterBlockedCells(encounter.blocked_cells);

  const base: CombatState = {
    gridWidth: encounter.grid_width,
    gridHeight: encounter.grid_height,
    tileFeet: encounter.tile_feet,
    backgroundPath: encounter.background_path,
    blockedCells,
    tokens: [],
    excludedPartyCharacterIds: [...allCharacterIds],
    initiative: { status: "none", results: {}, order: [] },
    turn: EMPTY_TURN,
    pendingAttacks: [],
    pendingOpportunityAttacks: null,
    boardTitle: encounter.name,
    savedEncounterId: encounter.id,
    autoApprove: false,
    autoApproveDm: true,
    xpPool: 0,
    battleParticipantCharacterIds: [],
    battleAmmoPrepared: false,
    reactionUsedTokenIds: [],
  };

  const tokens: CombatToken[] = [];

  for (const savedEnemy of data.enemies) {
    const enemy = enemiesBySlug[savedEnemy.enemySlug];
    if (!enemy) continue;
    tokens.push(createEnemyTokenFromSave(enemy, savedEnemy));
  }

  for (const savedMarker of data.markers) {
    tokens.push(createMarkerTokenFromSave(savedMarker));
  }

  for (const slot of data.characterSlots) {
    tokens.push(createCharacterPlaceholderToken(slot));
  }

  return {
    ...base,
    tokens: relabelEnemyTokens(tokens),
  };
}

export function formatTotalCr(totalCr: number): string {
  if (totalCr <= 0) return "0";
  const rounded = Math.round(totalCr * 100) / 100;
  if (Number.isInteger(rounded)) return String(rounded);
  return rounded.toFixed(2).replace(/\.?0+$/, "");
}

export function summarizeEncounterEnemies(
  encounter: Encounter,
  enemiesBySlug: Record<string, Pick<EnemyRecord, "name">>
): string[] {
  const data = parseSavedEncounterData(encounter.data);
  const counts = new Map<string, number>();

  for (const enemy of data.enemies) {
    const name = enemiesBySlug[enemy.enemySlug]?.name ?? enemy.enemySlug;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return [...counts.entries()].map(([name, count]) =>
    count > 1 ? `${name} ×${count}` : name
  );
}

export function getEncounterCounts(encounter: Encounter) {
  const data = parseSavedEncounterData(encounter.data);
  return {
    characterSlots: data.characterSlots.length,
    markers: data.markers.length,
    enemies: data.enemies.length,
  };
}

export function sortEncounters(
  encounters: Encounter[],
  sort: EncounterSort
): Encounter[] {
  const copy = [...encounters];
  switch (sort) {
    case "totalCr":
      return copy.sort((a, b) => {
        const crDiff = b.total_cr - a.total_cr;
        if (crDiff !== 0) return crDiff;
        return a.name.localeCompare(b.name);
      });
    case "updatedAt":
      return copy.sort((a, b) => {
        const timeDiff =
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        if (timeDiff !== 0) return timeDiff;
        return a.name.localeCompare(b.name);
      });
    case "name":
    default:
      return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
}

export function filterEncounters(
  encounters: Encounter[],
  query: string,
  enemiesBySlug: Record<string, Pick<EnemyRecord, "name">>
): Encounter[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return encounters;

  return encounters.filter((encounter) => {
    if (encounter.name.toLowerCase().includes(normalized)) return true;
    const enemyNames = summarizeEncounterEnemies(encounter, enemiesBySlug);
    return enemyNames.some((name) => name.toLowerCase().includes(normalized));
  });
}

export function buildDuplicateEncounterName(name: string, existingNames: Set<string>): string {
  const base = `Copy of ${name}`;
  if (!existingNames.has(base)) return base;

  let index = 2;
  while (existingNames.has(`${base} (${index})`)) {
    index += 1;
  }
  return `${base} (${index})`;
}

export type EncounterListItem = Encounter & {
  enemySummary: string[];
  characterSlotCount: number;
  markerCount: number;
};

export function enrichEncountersForList(
  encounters: Encounter[],
  enemiesBySlug: Record<string, Pick<EnemyRecord, "name">>
): EncounterListItem[] {
  return encounters.map((encounter) => {
    const counts = getEncounterCounts(encounter);
    return {
      ...encounter,
      enemySummary: summarizeEncounterEnemies(encounter, enemiesBySlug),
      characterSlotCount: counts.characterSlots,
      markerCount: counts.markers,
    };
  });
}

export function isPreBattleSetup(state: CombatState): boolean {
  return state.initiative.status === "none";
}
