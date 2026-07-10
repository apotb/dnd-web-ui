import type { ParsedCharacter } from "@/lib/character/utils";
import { applyAmmoRefillToInventory, canRefillAmmoContainers } from "@/lib/dnd/ammunition";
import { isBattleOver } from "@/lib/combat/battle-over";
import { applyObjectInteractionCosts } from "@/lib/combat/object-equipment-change";
import { getCurrentTurnTokenId, isBattleActive } from "@/lib/combat/turn";
import type { InventoryItem } from "@/lib/schemas/character";
import type { CombatState } from "@/lib/schemas/combat-state";
import type { Item } from "@/lib/schemas/item";

export type AmmoRefillResult =
  | {
      ok: true;
      next: CombatState;
      inventoryItems: InventoryItem[];
      characterId: string;
    }
  | { ok: false; error: string };

export function applyAmmoRefill(
  state: CombatState,
  actorTokenId: string,
  character: ParsedCharacter,
  catalogItems: Record<string, Item>
): AmmoRefillResult {
  if (!isBattleActive(state)) {
    return { ok: false, error: "Battle is not active." };
  }

  const actor = state.tokens.find((token) => token.id === actorTokenId);
  if (!actor || actor.kind !== "party" || !actor.characterId) {
    return { ok: false, error: "Only party characters can refill ammunition." };
  }

  const battleOver = isBattleOver(state);
  if (!battleOver && getCurrentTurnTokenId(state) !== actorTokenId) {
    return { ok: false, error: "You can only refill ammunition on your turn." };
  }

  if (!canRefillAmmoContainers(character.data.inventory.items, catalogItems)) {
    return { ok: false, error: "No ammunition available to refill quivers or cases." };
  }

  const costResult = applyObjectInteractionCosts(state, 1);
  if (!costResult.ok) {
    return costResult;
  }

  const inventoryItems = applyAmmoRefillToInventory(
    character.data.inventory.items,
    catalogItems
  );

  return {
    ok: true,
    next: costResult.next,
    inventoryItems,
    characterId: actor.characterId,
  };
}
