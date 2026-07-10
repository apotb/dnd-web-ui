import { getInitiativeTotal } from "@/lib/character/combat-derivation";
import type { ParsedCharacter } from "@/lib/character/utils";
import { abilityModifier, formatModifier } from "@/lib/dnd/calculations";
import type { CharacterData } from "@/lib/schemas/character";
import type {
  CombatState,
  CombatToken,
  InitiativeTokenResult,
} from "@/lib/schemas/combat-state";
import {
  isCombatantToken,
  isTokenInTurnOrder,
  normalizeCombatTurn,
} from "@/lib/schemas/combat-state";
import { adjustTurnAfterTokenRemoved, TURN_RESET_FIELDS } from "@/lib/combat/turn";
import type { EnemyData } from "@/lib/schemas/enemy";
import { abilityModifier as enemyAbilityModifier } from "@/lib/schemas/enemy";

export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

export function getPartyInitiativeBreakdown(data: CharacterData): {
  modifier: number;
  dexMod: number;
} {
  const dexMod = abilityModifier(data.abilityScores.dex);
  const bonus = data.combat.initiativeBonus ?? 0;
  return { modifier: dexMod + bonus, dexMod };
}

export function getEnemyInitiativeBreakdown(data: EnemyData): {
  modifier: number;
  dexMod: number;
} {
  const dexMod = enemyAbilityModifier(data.abilityScores.dex);
  const initiativeSkill = data.skills.find(
    (skill) => skill.name.trim().toLowerCase() === "initiative"
  );
  if (initiativeSkill) {
    return { modifier: initiativeSkill.bonus, dexMod };
  }
  return { modifier: dexMod, dexMod };
}

export function buildInitiativeResult(
  roll: number,
  modifier: number,
  dexMod: number
): InitiativeTokenResult {
  return {
    roll,
    modifier,
    dexMod,
    total: roll + modifier,
  };
}

export function autoRollInitiative(
  modifier: number,
  dexMod: number
): InitiativeTokenResult {
  return buildInitiativeResult(rollD20(), modifier, dexMod);
}

export function sortInitiativeTokenIds(
  tokens: CombatToken[],
  results: Record<string, InitiativeTokenResult>
): string[] {
  const withResults = tokens.filter((token) => results[token.id] != null);

  withResults.sort((a, b) => {
    const left = results[a.id];
    const right = results[b.id];
    if (right.total !== left.total) return right.total - left.total;
    if (right.dexMod !== left.dexMod) return right.dexMod - left.dexMod;
    // Stable tiebreaker so SSR and client hydration render the same order.
    return a.id.localeCompare(b.id);
  });

  return withResults.map((token) => token.id);
}

export function buildTurnOrder(
  tokens: CombatToken[],
  results: Record<string, InitiativeTokenResult>
): string[] {
  return sortInitiativeTokenIds(
    tokens.filter(isTokenInTurnOrder),
    results
  );
}

/** Rebuild initiative order from tokens and fix the active turn index. */
export function syncInitiativeOrder(state: CombatState): CombatState {
  if (state.initiative.status !== "ready") return state;

  const newOrder = buildTurnOrder(state.tokens, state.initiative.results);
  const oldOrder = state.initiative.order;

  if (
    newOrder.length === oldOrder.length &&
    newOrder.every((id, index) => id === oldOrder[index])
  ) {
    return state;
  }

  const currentTokenId = oldOrder[state.turn.index] ?? null;
  let newIndex = state.turn.index;

  if (currentTokenId) {
    const located = newOrder.indexOf(currentTokenId);
    if (located >= 0) {
      newIndex = located;
    } else {
      newIndex = adjustTurnAfterTokenRemoved(state.turn, currentTokenId, oldOrder).index;
    }
  }

  if (newOrder.length === 0) {
    newIndex = 0;
  } else {
    newIndex = Math.min(Math.max(0, newIndex), newOrder.length - 1);
  }

  return normalizeCombatTurn({
    ...state,
    initiative: {
      ...state.initiative,
      order: newOrder,
    },
    turn: {
      ...state.turn,
      index: newIndex,
    },
  });
}

export function allInitiativeResultsCollected(state: CombatState): boolean {
  if (state.initiative.status !== "collecting") return false;
  const combatants = state.tokens.filter(isCombatantToken);
  if (combatants.length === 0) return false;
  return combatants.every((token) => state.initiative.results[token.id] != null);
}

export function finalizeInitiativeIfReady(state: CombatState): CombatState {
  if (!allInitiativeResultsCollected(state)) return state;

  return {
    ...state,
    initiative: {
      ...state.initiative,
      status: "ready",
      order: buildTurnOrder(state.tokens, state.initiative.results),
    },
    turn: { active: true, index: 0, round: 1, ...TURN_RESET_FIELDS },
  };
}

export function clearInitiativeState(state: CombatState): CombatState {
  return {
    ...state,
    initiative: { status: "none", results: {}, order: [] },
    turn: { active: false, index: 0, round: 1, ...TURN_RESET_FIELDS },
  };
}

/** Unclaimed characters and characters claimed by the DM roll automatically at battle start. */
export function characterUsesAutoInitiativeRoll(
  ownerUserId: string | null,
  dmUserId: string | null
): boolean {
  if (!dmUserId) return ownerUserId === null;
  return ownerUserId === null || ownerUserId === dmUserId;
}

export function getTokensNeedingPlayerRolls(
  state: CombatState,
  characters: ParsedCharacter[],
  dmUserId: string | null
): ParsedCharacter[] {
  const charactersById = new Map(characters.map((character) => [character.id, character]));

  return state.tokens
    .filter((token) => {
      if (token.kind !== "party" || !token.characterId) return false;
      const character = charactersById.get(token.characterId);
      if (!character) return false;
      if (characterUsesAutoInitiativeRoll(character.owner_user_id, dmUserId)) return false;
      return state.initiative.results[token.id] == null;
    })
    .map((token) => charactersById.get(token.characterId!)!)
    .filter(Boolean);
}

export function startInitiativeCollection(
  state: CombatState,
  characters: ParsedCharacter[],
  enemiesBySlug: Record<string, { data: EnemyData }>,
  dmUserId: string | null
): CombatState {
  const charactersById = new Map(characters.map((character) => [character.id, character]));
  const results: Record<string, InitiativeTokenResult> = {};

  for (const token of state.tokens) {
    if (token.kind === "enemy" && token.enemySlug) {
      const enemy = enemiesBySlug[token.enemySlug];
      if (!enemy) continue;
      const { modifier, dexMod } = getEnemyInitiativeBreakdown(enemy.data);
      results[token.id] = autoRollInitiative(modifier, dexMod);
      continue;
    }

    if (token.kind === "party" && token.characterId) {
      const character = charactersById.get(token.characterId);
      if (!character) continue;
      if (!characterUsesAutoInitiativeRoll(character.owner_user_id, dmUserId)) continue;
      const { modifier, dexMod } = getPartyInitiativeBreakdown(character.data);
      results[token.id] = autoRollInitiative(modifier, dexMod);
    }
  }

  return {
    ...state,
    initiative: {
      status: "collecting",
      results,
      order: [],
    },
    turn: { active: false, index: 0, round: 1, ...TURN_RESET_FIELDS },
  };
}

export function applyPlayerInitiativeRoll(
  state: CombatState,
  tokenId: string,
  roll: number,
  modifier: number,
  dexMod: number
): CombatState {
  const next: CombatState = {
    ...state,
    initiative: {
      ...state.initiative,
      results: {
        ...state.initiative.results,
        [tokenId]: buildInitiativeResult(roll, modifier, dexMod),
      },
    },
  };

  return finalizeInitiativeIfReady(next);
}

export function updateInitiativeAfterVisibilityChange(
  state: CombatState,
  tokenId: string,
  wasHidden: boolean,
  isHidden: boolean
): CombatState {
  if (state.initiative.status !== "ready" || wasHidden === isHidden) return state;

  const oldOrder = state.initiative.order;
  const newOrder = buildTurnOrder(state.tokens, state.initiative.results);

  const turn = isHidden
    ? adjustTurnAfterTokenRemoved(state.turn, tokenId, oldOrder)
    : (() => {
        const currentTokenId = oldOrder[state.turn.index];
        const newIndex =
          currentTokenId != null
            ? Math.max(0, newOrder.indexOf(currentTokenId))
            : state.turn.index;
        return {
          ...state.turn,
          index: newOrder.length > 0 ? Math.min(newIndex, newOrder.length - 1) : 0,
        };
      })();

  return {
    ...state,
    initiative: {
      ...state.initiative,
      order: newOrder,
    },
    turn,
  };
}

/** Reconcile initiative when tokens become hidden (e.g. defeated enemies). */
export function syncInitiativeAfterTokenHidden(
  previous: CombatState,
  next: CombatState
): CombatState {
  let result = next;
  for (const token of next.tokens) {
    if (token.kind !== "enemy") continue;
    const prev = previous.tokens.find((entry) => entry.id === token.id);
    if (!prev) continue;
    const wasHidden = prev.hidden ?? false;
    const isHidden = token.hidden ?? false;
    if (!wasHidden && isHidden) {
      result = updateInitiativeAfterVisibilityChange(result, token.id, false, true);
    }
  }
  return result;
}

export function getAddedCombatantTokens(
  previous: CombatState,
  next: CombatState
): CombatToken[] {
  const previousIds = new Set(previous.tokens.map((token) => token.id));
  return next.tokens.filter(
    (token) => !previousIds.has(token.id) && isCombatantToken(token)
  );
}

/** Roll initiative for combatants added mid-battle or during collection. */
export function integrateNewCombatantsInitiative(
  state: CombatState,
  addedTokens: CombatToken[],
  characters: ParsedCharacter[],
  enemiesBySlug: Record<string, { data: EnemyData }>,
  dmUserId: string | null
): {
  state: CombatState;
  charactersNeedingPlayerRolls: ParsedCharacter[];
} {
  if (state.initiative.status === "none" || addedTokens.length === 0) {
    return { state, charactersNeedingPlayerRolls: [] };
  }

  const charactersById = new Map(characters.map((character) => [character.id, character]));
  const results = { ...state.initiative.results };
  const charactersNeedingPlayerRolls: ParsedCharacter[] = [];

  for (const token of addedTokens.filter(isCombatantToken)) {
    if (results[token.id] != null) continue;

    if (token.kind === "enemy" && token.enemySlug) {
      const enemy = enemiesBySlug[token.enemySlug];
      if (!enemy) continue;
      const { modifier, dexMod } = getEnemyInitiativeBreakdown(enemy.data);
      results[token.id] = autoRollInitiative(modifier, dexMod);
      continue;
    }

    if (token.kind === "party" && token.characterId) {
      const character = charactersById.get(token.characterId);
      if (!character) continue;
      if (characterUsesAutoInitiativeRoll(character.owner_user_id, dmUserId)) {
        const { modifier, dexMod } = getPartyInitiativeBreakdown(character.data);
        results[token.id] = autoRollInitiative(modifier, dexMod);
      } else {
        charactersNeedingPlayerRolls.push(character);
      }
    }
  }

  let next: CombatState = {
    ...state,
    initiative: {
      ...state.initiative,
      results,
    },
  };

  if (next.initiative.status === "collecting") {
    next = finalizeInitiativeIfReady(next);
  } else if (next.initiative.status === "ready") {
    next = syncInitiativeOrder(next);
  }

  return { state: next, charactersNeedingPlayerRolls };
}

export function getPartyInitiativeModifierForCharacter(
  character: ParsedCharacter
): number {
  return getInitiativeTotal(character.data);
}

export function formatInitiativeResultTooltip(
  label: string,
  result: InitiativeTokenResult
): string {
  return [
    label,
    `d20: ${result.roll}`,
    `Initiative modifier: ${formatModifier(result.modifier)}`,
    `Total: ${result.total}`,
  ].join("\n");
}
