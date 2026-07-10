import { autoLoadAmmoContainers, unloadAmmoContainers } from "@/lib/dnd/ammunition";
import type { ParsedCharacter } from "@/lib/character/utils";
import type { InventoryItem } from "@/lib/schemas/character";
import type { CombatState } from "@/lib/schemas/combat-state";
import type { Item } from "@/lib/schemas/item";

export function getPartyCharacterIdsOnBoard(state: CombatState): string[] {
  return [
    ...new Set(
      state.tokens
        .filter((token) => token.kind === "party" && token.characterId)
        .map((token) => token.characterId!)
    ),
  ];
}

export function prepareCharacterBattleAmmo(
  items: InventoryItem[],
  catalogItems: Record<string, Item>
): InventoryItem[] {
  return autoLoadAmmoContainers(items, catalogItems);
}

export function unloadCharacterBattleAmmo(
  items: InventoryItem[],
  catalogItems: Record<string, Item>
): InventoryItem[] {
  return unloadAmmoContainers(items, catalogItems);
}

export function inventoryItemsChanged(
  before: InventoryItem[],
  after: InventoryItem[]
): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}

export function preparePartyBattleAmmo(
  characters: ParsedCharacter[],
  state: CombatState,
  catalogItems: Record<string, Item>
): Map<string, InventoryItem[]> {
  const characterIds = new Set(getPartyCharacterIdsOnBoard(state));
  const updates = new Map<string, InventoryItem[]>();

  for (const character of characters) {
    if (!characterIds.has(character.id)) continue;
    const nextItems = prepareCharacterBattleAmmo(
      character.data.inventory.items,
      catalogItems
    );
    if (inventoryItemsChanged(character.data.inventory.items, nextItems)) {
      updates.set(character.id, nextItems);
    }
  }

  return updates;
}

export function unloadPartyBattleAmmo(
  characters: ParsedCharacter[],
  catalogItems: Record<string, Item>
): Map<string, InventoryItem[]> {
  const updates = new Map<string, InventoryItem[]>();

  for (const character of characters) {
    const nextItems = unloadCharacterBattleAmmo(
      character.data.inventory.items,
      catalogItems
    );
    if (inventoryItemsChanged(character.data.inventory.items, nextItems)) {
      updates.set(character.id, nextItems);
    }
  }

  return updates;
}

export function markBattleAmmoPrepared(state: CombatState): CombatState {
  return { ...state, battleAmmoPrepared: true };
}
