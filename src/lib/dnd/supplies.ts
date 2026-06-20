import {
  sameHarptosDate,
  type HarptosDate,
} from "@/lib/dnd/harptos-calendar";
import type {
  CharacterData,
  InventoryItem,
  Supplies,
} from "@/lib/schemas/character";
import type { WorldData } from "@/lib/schemas/world";

const FOOD_ITEM_IDS = new Set(["rations"]);
const WATER_ITEM_IDS = new Set(["waterskin"]);

function normalizeItemName(name: string): string {
  return name.trim().toLowerCase();
}

export function isFoodItem(item: InventoryItem): boolean {
  if (item.quantity <= 0) return false;
  if (item.itemId && FOOD_ITEM_IDS.has(item.itemId)) return true;
  const name = normalizeItemName(item.name);
  return name.includes("rations") || name.includes("ration (1 day)");
}

export function isWaterItem(item: InventoryItem): boolean {
  if (item.quantity <= 0) return false;
  if (item.itemId && WATER_ITEM_IDS.has(item.itemId)) return true;
  const name = normalizeItemName(item.name);
  if (name.includes("holy water")) return false;
  return name.includes("waterskin") || name === "water";
}

export function getFoodItems(data: CharacterData): InventoryItem[] {
  return data.inventory.items.filter(isFoodItem);
}

export function getWaterItems(data: CharacterData): InventoryItem[] {
  return data.inventory.items.filter(isWaterItem);
}

export function isFedForDate(
  supplies: Supplies,
  date: HarptosDate
): boolean {
  return !!supplies.fedDate && sameHarptosDate(supplies.fedDate, date);
}

export function isWateredForDate(
  supplies: Supplies,
  date: HarptosDate
): boolean {
  return !!supplies.wateredDate && sameHarptosDate(supplies.wateredDate, date);
}

export function needsFood(
  data: CharacterData,
  worldData: WorldData
): boolean {
  if (!worldData.dailySuppliesActive) return false;
  return !isFedForDate(data.supplies, worldData.calendar);
}

export function needsWater(
  data: CharacterData,
  worldData: WorldData
): boolean {
  if (!worldData.dailySuppliesActive) return false;
  return !isWateredForDate(data.supplies, worldData.calendar);
}

export function consumeInventoryItem(
  items: InventoryItem[],
  inventoryItemId: string
): InventoryItem[] {
  return items.flatMap((item) => {
    if (item.id !== inventoryItemId) return [item];
    const quantity = item.quantity - 1;
    if (quantity <= 0) return [];
    return [{ ...item, quantity }];
  });
}

export function markFed(
  data: CharacterData,
  date: HarptosDate,
  inventoryItemId: string
): CharacterData {
  return {
    ...data,
    supplies: { ...data.supplies, fedDate: date },
    inventory: {
      ...data.inventory,
      items: consumeInventoryItem(data.inventory.items, inventoryItemId),
    },
  };
}

export function markWatered(
  data: CharacterData,
  date: HarptosDate,
  inventoryItemId: string
): CharacterData {
  return {
    ...data,
    supplies: { ...data.supplies, wateredDate: date },
    inventory: {
      ...data.inventory,
      items: consumeInventoryItem(data.inventory.items, inventoryItemId),
    },
  };
}
