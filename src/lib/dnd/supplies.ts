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
import { mergeIntoInventory } from "@/lib/character/inventory-stack";

const FOOD_ITEM_IDS = new Set(["rations"]);
const WATER_ITEM_IDS = new Set(["waterskin"]);
export const WATERSKIN_ITEM_ID = "waterskin";
export const EMPTY_WATERSKIN_ITEM_ID = "empty-waterskin";

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
  if (isEmptyWaterskinItem(item)) return false;
  if (item.itemId && WATER_ITEM_IDS.has(item.itemId)) return true;
  const name = normalizeItemName(item.name);
  if (name.includes("holy water")) return false;
  if (name.includes("empty") && name.includes("waterskin")) return false;
  return name.includes("waterskin") || name === "water";
}

export function isEmptyWaterskinItem(item: InventoryItem): boolean {
  if (item.itemId === EMPTY_WATERSKIN_ITEM_ID) return true;
  const name = normalizeItemName(item.name);
  return name.includes("empty") && name.includes("waterskin");
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

function toEmptyWaterskin(item: InventoryItem): InventoryItem {
  return {
    ...item,
    id: crypto.randomUUID(),
    itemId: EMPTY_WATERSKIN_ITEM_ID,
    name: "",
    quantity: 1,
    equipped: false,
    wieldMain: false,
    wieldOff: false,
  };
}

function toFullWaterskin(item: InventoryItem): InventoryItem {
  return {
    ...item,
    id: crypto.randomUUID(),
    itemId: WATERSKIN_ITEM_ID,
    name: "",
    quantity: 1,
    equipped: false,
    wieldMain: false,
    wieldOff: false,
  };
}

/** Replace one empty waterskin with a full waterskin in inventory. */
export function fillEmptyWaterskin(
  items: InventoryItem[],
  inventoryItemId: string
): InventoryItem[] | null {
  const item = items.find((row) => row.id === inventoryItemId);
  if (!item || !isEmptyWaterskinItem(item) || item.quantity <= 0) return null;

  let next = consumeInventoryItem(items, inventoryItemId);
  next = mergeIntoInventory(next, toFullWaterskin(item));
  return next;
}

/** Decrement a waterskin stack and leave an empty waterskin instead of deleting. */
export function consumeWaterItem(
  items: InventoryItem[],
  inventoryItemId: string
): InventoryItem[] {
  let next = items;

  for (const item of items) {
    if (item.id !== inventoryItemId) continue;

    const quantity = item.quantity - 1;
    next = next.filter((row) => row.id !== inventoryItemId);
    if (quantity > 0) {
      next = [...next, { ...item, quantity }];
    }
    next = mergeIntoInventory(next, toEmptyWaterskin(item));
    break;
  }

  return next;
}

export function markFed(
  data: CharacterData,
  date: HarptosDate,
  inventoryItemId: string
): CharacterData {
  return {
    ...markFedManually(data, date),
    inventory: {
      ...data.inventory,
      items: consumeInventoryItem(data.inventory.items, inventoryItemId),
    },
  };
}

/** Mark fed for the day without consuming inventory (tavern, inn, etc.). */
export function markFedManually(
  data: CharacterData,
  date: HarptosDate
): CharacterData {
  return {
    ...data,
    supplies: {
      ...data.supplies,
      fedDate: date,
      daysWithoutFood: 0,
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
    ...applyWaterGallons(data, gallons, required, date),
    inventory: {
      ...data.inventory,
      items: consumeWaterItem(data.inventory.items, inventoryItemId),
    },
  };
}

function applyWaterGallons(
  data: CharacterData,
  gallons: number,
  required: number,
  date: HarptosDate
): CharacterData {
  return {
    ...data,
    supplies: {
      ...data.supplies,
      waterGallonsToday: gallons,
      wateredDate: gallons >= required ? date : data.supplies.wateredDate,
    },
  };
}

/** Satisfy today's water needs without consuming a waterskin. */
export function markWateredManually(
  data: CharacterData,
  date: HarptosDate,
  worldData: WorldData
): CharacterData {
  const required = getRequiredWaterGallons(worldData);
  const gallons = Math.max(data.supplies.waterGallonsToday, required);
  return applyWaterGallons(data, gallons, required, date);
}
