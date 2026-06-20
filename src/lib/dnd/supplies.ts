import {
  sameHarptosDate,
  type HarptosDate,
} from "@/lib/dnd/harptos-calendar";
import {
  getRequiredWaterGallons,
  WATERSKIN_GALLONS,
  formatGallons,
} from "@/lib/dnd/survival";
import type {
  CharacterData,
  InventoryItem,
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

/** Days of food satisfied when this item is consumed. */
export function getFoodItemDays(_item: InventoryItem): number {
  return 1;
}

/** Gallons of water provided when this item is consumed. */
export function getWaterItemGallons(_item: InventoryItem): number {
  return WATERSKIN_GALLONS;
}

export function formatSupplyItemTooltip(
  item: InventoryItem,
  kind: "food" | "water"
): string {
  const lines: string[] = [item.name || "Unnamed item"];

  if (kind === "food") {
    const days = getFoodItemDays(item);
    lines.push(
      `Provides: ${days} day${days === 1 ? "" : "s"} of food`
    );
  } else {
    const gallons = getWaterItemGallons(item);
    lines.push(`Provides: ${formatGallons(gallons)} gal water`);
  }

  return lines.join("\n");
}

export function isFedForDate(
  data: CharacterData,
  date: HarptosDate
): boolean {
  return (
    !!data.supplies.fedDate && sameHarptosDate(data.supplies.fedDate, date)
  );
}

export function hasEnoughWaterToday(
  data: CharacterData,
  worldData: WorldData
): boolean {
  return data.supplies.waterGallonsToday >= getRequiredWaterGallons(worldData);
}

export function needsFood(
  data: CharacterData,
  worldData: WorldData
): boolean {
  if (!worldData.dailySuppliesActive) return false;
  return !isFedForDate(data, worldData.calendar);
}

export function needsWater(
  data: CharacterData,
  worldData: WorldData
): boolean {
  if (!worldData.dailySuppliesActive) return false;
  return !hasEnoughWaterToday(data, worldData);
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
    supplies: {
      ...data.supplies,
      fedDate: date,
      daysWithoutFood: 0,
    },
    inventory: {
      ...data.inventory,
      items: consumeInventoryItem(data.inventory.items, inventoryItemId),
    },
  };
}

export function markWatered(
  data: CharacterData,
  date: HarptosDate,
  inventoryItemId: string,
  worldData: WorldData
): CharacterData {
  const gallons = data.supplies.waterGallonsToday + WATERSKIN_GALLONS;
  const required = getRequiredWaterGallons(worldData);

  return {
    ...data,
    supplies: {
      ...data.supplies,
      waterGallonsToday: gallons,
      wateredDate: gallons >= required ? date : data.supplies.wateredDate,
    },
    inventory: {
      ...data.inventory,
      items: consumeInventoryItem(data.inventory.items, inventoryItemId),
    },
  };
}
