import type { ParsedCharacter } from "@/lib/character/utils";
import { mergeIntoInventory } from "@/lib/character/inventory-stack";
import { distributePickedUpAmmo, isRecoverableAmmunition } from "@/lib/dnd/ammunition";
import { isBattleOver } from "@/lib/combat/battle-over";
import { areTokensWithinMeleeRange } from "@/lib/combat/engagement";
import {
  applyObjectInteractionCosts,
  hasEquippableInventoryItems,
} from "@/lib/combat/object-equipment-change";
import { canRefillAmmoContainers } from "@/lib/dnd/ammunition";
import { removeTokenFromState } from "@/lib/combat/state-utils";
import {
  canUserActForToken,
  canUserControlTurn,
  getCurrentTurnTokenId,
  isBattleActive,
} from "@/lib/combat/turn";
import type { InventoryItem } from "@/lib/schemas/character";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import type { Item } from "@/lib/schemas/item";

export function isPickupMarker(token: CombatToken): boolean {
  return (
    token.kind === "marker" &&
    token.isObject === true &&
    token.itemPickup === true &&
    Boolean(token.pickupItemId?.trim())
  );
}

export function getAdjacentPickupMarkers(
  actor: CombatToken,
  state: CombatState
): CombatToken[] {
  if (!actor.placed) return [];

  return state.tokens.filter(
    (token) =>
      isPickupMarker(token) &&
      token.placed &&
      areTokensWithinMeleeRange(actor, token)
  );
}

export interface ObjectInteractionContext {
  state: CombatState;
  actorToken: CombatToken;
  character: ParsedCharacter | null;
  userId: string | null;
  isDm: boolean;
  catalogItems?: Record<string, Item>;
}

export function canStartObjectInteraction(context: ObjectInteractionContext): boolean {
  if (!isBattleActive(context.state)) return false;
  if (context.actorToken.kind !== "party" || !context.actorToken.characterId) {
    return false;
  }

  const battleOver = isBattleOver(context.state);
  if (battleOver) {
    if (
      !canUserActForToken(
        context.userId,
        context.isDm,
        context.actorToken,
        context.character
      )
    ) {
      return false;
    }
  } else if (
    !canUserControlTurn(
      context.userId,
      context.isDm,
      context.state,
      context.actorToken,
      context.character
    )
  ) {
    return false;
  }

  const turn = battleOver
    ? { ...context.state.turn, freeObjectInteractionUsed: false, actionUsed: false }
    : context.state.turn;
  if (turn.freeObjectInteractionUsed && turn.actionUsed) return false;

  const hasPickups =
    getAdjacentPickupMarkers(context.actorToken, context.state).length > 0;
  const hasEquipment =
    context.character &&
    context.catalogItems &&
    hasEquippableInventoryItems(context.character, context.catalogItems);
  const hasRefill =
    context.character &&
    context.catalogItems &&
    canRefillAmmoContainers(context.character.data.inventory.items, context.catalogItems);

  return hasPickups || Boolean(hasEquipment) || Boolean(hasRefill);
}

function catalogItemToInventoryItem(item: Item, quantity: number): InventoryItem {
  return {
    id: crypto.randomUUID(),
    itemId: item.slug,
    name: item.name,
    quantity,
    magicItem: item.is_magic,
    equipped: false,
    wieldMain: false,
    wieldOff: false,
    attuned: false,
    notes: "",
    loadedQuantity: 0,
  };
}

export type ObjectPickupResult =
  | {
      ok: true;
      next: CombatState;
      inventoryItems: InventoryItem[];
      characterId: string;
    }
  | { ok: false; error: string };

export function applyObjectPickup(
  state: CombatState,
  actorTokenId: string,
  markerId: string,
  character: ParsedCharacter,
  catalogItems: Record<string, Item>
): ObjectPickupResult {
  if (!isBattleActive(state)) {
    return { ok: false, error: "Battle is not active." };
  }

  const actor = state.tokens.find((token) => token.id === actorTokenId);
  if (!actor || actor.kind !== "party" || !actor.characterId) {
    return { ok: false, error: "Only party characters can pick up objects." };
  }

  const battleOver = isBattleOver(state);
  if (!battleOver && getCurrentTurnTokenId(state) !== actorTokenId) {
    return { ok: false, error: "You can only pick up objects on your turn." };
  }

  const marker = state.tokens.find((token) => token.id === markerId);
  if (!marker || !isPickupMarker(marker)) {
    return { ok: false, error: "That marker cannot be picked up." };
  }

  if (!areTokensWithinMeleeRange(actor, marker)) {
    return { ok: false, error: "You must be adjacent to pick up that object." };
  }

  const catalogItem = catalogItems[marker.pickupItemId!];
  if (!catalogItem) {
    return { ok: false, error: "Pickup item is not available in the catalog." };
  }

  const turn = state.turn;
  if (!battleOver && turn.freeObjectInteractionUsed && turn.actionUsed) {
    return { ok: false, error: "You have already used your object interactions this turn." };
  }

  const costResult = applyObjectInteractionCosts(state, 1);
  if (!costResult.ok) {
    return costResult;
  }
  let next = costResult.next;

  const quantity = Math.max(1, marker.pickupQuantity ?? 1);
  const ammoSlug = catalogItem.slug.trim().toLowerCase();
  const inventoryItems = isRecoverableAmmunition(ammoSlug)
    ? distributePickedUpAmmo(
        character.data.inventory.items,
        ammoSlug,
        quantity,
        catalogItems
      )
    : mergeIntoInventory(
        character.data.inventory.items,
        catalogItemToInventoryItem(catalogItem, quantity)
      );

  next = removeTokenFromState(next, markerId);

  return {
    ok: true,
    next,
    inventoryItems,
    characterId: actor.characterId,
  };
}
