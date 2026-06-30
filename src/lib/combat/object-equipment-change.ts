import type { ParsedCharacter } from "@/lib/character/utils";
import {
  canEquipInventoryItem,
  getEffectiveWieldMain,
  getEffectiveWieldOff,
  getItemEquipSlot,
  sanitizeEquippedItems,
} from "@/lib/character/equip-rules";
import { applyBattleOverEconomyReset, isBattleOver } from "@/lib/combat/battle-over";
import {
  applyActionUsed,
  applyFreeObjectInteractionUsed,
  getCurrentTurnTokenId,
  isBattleActive,
} from "@/lib/combat/turn";
import type { InventoryItem } from "@/lib/schemas/character";
import type { CombatState, CombatTurn } from "@/lib/schemas/combat-state";
import type { Item } from "@/lib/schemas/item";

export function hasEquippableInventoryItems(
  character: ParsedCharacter,
  catalogItems: Record<string, Item>
): boolean {
  const speciesName = character.data.basicInfo.species ?? "";
  return character.data.inventory.items.some((item) => {
    const catalog = item.itemId ? catalogItems[item.itemId] ?? null : null;
    return canEquipInventoryItem(catalog, item, speciesName);
  });
}

export function getAvailableObjectInteractions(
  turn: Pick<CombatTurn, "freeObjectInteractionUsed" | "actionUsed">
): number {
  if (turn.freeObjectInteractionUsed && turn.actionUsed) return 0;
  if (!turn.freeObjectInteractionUsed && !turn.actionUsed) return 2;
  return 1;
}

export function applyObjectInteractionCosts(
  state: CombatState,
  count: number
): { ok: true; next: CombatState } | { ok: false; error: string } {
  if (count < 1 || count > 2) {
    return { ok: false, error: "Invalid object interaction count." };
  }

  const battleOver = isBattleOver(state);
  const turn = state.turn;

  if (!battleOver && turn.freeObjectInteractionUsed && turn.actionUsed) {
    return { ok: false, error: "You have already used your object interactions this turn." };
  }

  if (battleOver) {
    return { ok: true, next: { ...state, turn: applyBattleOverEconomyReset(state.turn) } };
  }

  const available = getAvailableObjectInteractions(turn);
  if (count > available) {
    return {
      ok: false,
      error:
        count > 1
          ? "That many equipment changes require your free object interaction and your action."
          : "You have already used your object interactions this turn.",
    };
  }

  let next = state;
  for (let i = 0; i < count; i++) {
    if (!next.turn.freeObjectInteractionUsed) {
      next = applyFreeObjectInteractionUsed(next);
    } else if (!next.turn.actionUsed) {
      next = applyActionUsed(next);
    } else {
      return { ok: false, error: "You have already used your action this turn." };
    }
  }

  return { ok: true, next };
}

export function countEquipmentToggles(
  before: InventoryItem[],
  after: InventoryItem[],
  catalogItems: Record<string, Item>
): number {
  return countEquipmentFlagToggles(before, after, catalogItems);
}

function countEquipmentFlagToggles(
  before: InventoryItem[],
  after: InventoryItem[],
  catalogItems: Record<string, Item>
): number {
  const beforeMap = new Map(before.map((item) => [item.id, item]));
  let toggles = 0;

  for (const item of after) {
    const prev = beforeMap.get(item.id);
    if (!prev) continue;

    const catalog = item.itemId ? catalogItems[item.itemId] ?? null : null;
    const slot = getItemEquipSlot(catalog, item);

    if (slot === "weapon") {
      const prevMain = getEffectiveWieldMain(prev, catalog);
      const nextMain = getEffectiveWieldMain(item, catalog);
      const prevOff = getEffectiveWieldOff(prev);
      const nextOff = getEffectiveWieldOff(item);
      if (prevMain !== nextMain) toggles++;
      if (prevOff !== nextOff) toggles++;
    } else if (slot === "armor" || slot === "shield") {
      if (!!prev.equipped !== !!item.equipped) toggles++;
    }
  }

  return toggles;
}

export function describeObjectInteractionCost(
  count: number,
  turn?: Pick<CombatTurn, "freeObjectInteractionUsed" | "actionUsed">
): string {
  if (count <= 0) return "";
  if (count === 1) {
    if (turn?.freeObjectInteractionUsed) {
      return "Uses your action.";
    }
    return "Uses your free object interaction.";
  }
  if (turn?.freeObjectInteractionUsed) {
    return "Uses your action twice.";
  }
  if (turn?.actionUsed) {
    return "Uses your free object interaction twice.";
  }
  return "Uses your free object interaction and your action.";
}

export type EquipmentChangeResult =
  | {
      ok: true;
      next: CombatState;
      inventoryItems: InventoryItem[];
      characterId: string;
      interactionCount: number;
    }
  | { ok: false; error: string };

export function applyEquipmentChange(
  state: CombatState,
  actorTokenId: string,
  character: ParsedCharacter,
  nextItems: InventoryItem[],
  catalogItems: Record<string, Item>
): EquipmentChangeResult {
  if (!isBattleActive(state)) {
    return { ok: false, error: "Battle is not active." };
  }

  const actor = state.tokens.find((token) => token.id === actorTokenId);
  if (!actor || actor.kind !== "party" || !actor.characterId) {
    return { ok: false, error: "Only party characters can change equipment." };
  }

  const battleOver = isBattleOver(state);
  if (!battleOver && getCurrentTurnTokenId(state) !== actorTokenId) {
    return { ok: false, error: "You can only change equipment on your turn." };
  }

  const speciesName = character.data.basicInfo.species ?? "";
  const beforeItems = character.data.inventory.items;
  const interactionCount = countEquipmentFlagToggles(beforeItems, nextItems, catalogItems);

  if (interactionCount === 0) {
    return { ok: false, error: "No equipment changes to apply." };
  }

  const costResult = applyObjectInteractionCosts(state, interactionCount);
  if (!costResult.ok) {
    return costResult;
  }

  const inventoryItems = sanitizeEquippedItems(
    nextItems,
    catalogItems,
    speciesName
  );

  return {
    ok: true,
    next: costResult.next,
    inventoryItems,
    characterId: actor.characterId,
    interactionCount,
  };
}
