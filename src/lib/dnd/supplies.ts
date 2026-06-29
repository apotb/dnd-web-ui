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
/** Flat hydration from "drank elsewhere" in the player water picker. */
export const ELSEWHERE_WATER_GALLONS = 0.25;

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

/** Add a flat amount of water without consuming inventory. */
export function addWaterGallons(
  data: CharacterData,
  date: HarptosDate,
  worldData: WorldData,
  amount: number
): CharacterData {
  const required = getRequiredWaterGallons(worldData);
  const gallons = data.supplies.waterGallonsToday + amount;
  return applyWaterGallons(data, gallons, required, date);
}

/** Small sip from a non-inventory source (stream, rain, etc.). */
export function markWateredElsewhere(
  data: CharacterData,
  date: HarptosDate,
  worldData: WorldData
): CharacterData {
  return addWaterGallons(data, date, worldData, ELSEWHERE_WATER_GALLONS);
}

/** Mark half of today's required water without consuming inventory. */
export function markWateredHalf(
  data: CharacterData,
  date: HarptosDate,
  worldData: WorldData
): CharacterData {
  const required = getRequiredWaterGallons(worldData);
  const halfRequired = required / 2;
  const gallons = Math.max(data.supplies.waterGallonsToday, halfRequired);
  return applyWaterGallons(data, gallons, required, date);
}

export type EndOfDayFoodChoice =
  | { source: "inventory"; itemId: string }
  | { source: "elsewhere" }
  | { source: "none" };

export type EndOfDayWaterElsewhereChoice = "none" | "half" | "full";

export type EndOfDaySuppliesChoice = {
  food: EndOfDayFoodChoice;
  /** Waterskin stacks to consume: inventory item id → count (supports multiple skins). */
  waterItemCounts: Record<string, number>;
  /** Drink water from a source other than inventory. */
  waterElsewhere: EndOfDayWaterElsewhereChoice;
};

export function getWaterGallonsFromEndOfDayChoice(
  choice: EndOfDaySuppliesChoice,
  worldData: WorldData
): number {
  if (choice.waterElsewhere === "full") {
    return getRequiredWaterGallons(worldData);
  }
  if (choice.waterElsewhere === "half") {
    return getRequiredWaterGallons(worldData) / 2;
  }

  return Object.values(choice.waterItemCounts).reduce(
    (total, count) => total + Math.max(0, count) * WATERSKIN_GALLONS,
    0
  );
}

export function getEndOfDayWaterStatus(
  gallons: number,
  worldData: WorldData
): "full" | "half" | "none" {
  const required = getRequiredWaterGallons(worldData);
  const halfRequired = required / 2;
  if (gallons >= required) return "full";
  if (gallons >= halfRequired) return "half";
  return "none";
}

export function getEndOfDaySuppliesChoiceFromData(
  data: CharacterData,
  date: HarptosDate,
  worldData: WorldData
): EndOfDaySuppliesChoice {
  const gallons = data.supplies.waterGallonsToday;
  const required = getRequiredWaterGallons(worldData);
  const status = getEndOfDayWaterStatus(gallons, worldData);

  return {
    food: isFedForDate(data, date)
      ? { source: "elsewhere" }
      : { source: "none" },
    waterItemCounts: {},
    waterElsewhere:
      status === "full" && gallons >= required ? "full" : "none",
  };
}

function clearFedForDate(
  data: CharacterData,
  date: HarptosDate
): CharacterData {
  if (!data.supplies.fedDate || !sameHarptosDate(data.supplies.fedDate, date)) {
    return data;
  }

  return {
    ...data,
    supplies: {
      ...data.supplies,
      fedDate: null,
    },
  };
}

function clearWaterForDate(
  data: CharacterData,
  date: HarptosDate
): CharacterData {
  return {
    ...data,
    supplies: {
      ...data.supplies,
      waterGallonsToday: 0,
      wateredDate:
        data.supplies.wateredDate &&
        sameHarptosDate(data.supplies.wateredDate, date)
          ? null
          : data.supplies.wateredDate,
    },
  };
}

function applyWaterFromInventoryCounts(
  data: CharacterData,
  date: HarptosDate,
  worldData: WorldData,
  waterItemCounts: Record<string, number>
): CharacterData {
  let next = clearWaterForDate(data, date);

  for (const [itemId, count] of Object.entries(waterItemCounts)) {
    const uses = Math.max(0, Math.floor(count));
    for (let i = 0; i < uses; i++) {
      const hasItem = next.inventory.items.some(
        (item) => item.id === itemId && isWaterItem(item)
      );
      if (!hasItem) break;
      next = markWatered(next, date, itemId, worldData);
    }
  }

  return next;
}

/** Apply DM end-of-day food/water choices before survival processing. */
export function applyEndOfDaySuppliesChoice(
  data: CharacterData,
  date: HarptosDate,
  worldData: WorldData,
  choice: EndOfDaySuppliesChoice
): CharacterData {
  let next = data;

  if (choice.food.source === "inventory") {
    next = markFed(next, date, choice.food.itemId);
  } else if (choice.food.source === "elsewhere") {
    next = markFedManually(next, date);
  } else {
    next = clearFedForDate(next, date);
  }

  if (choice.waterElsewhere === "full") {
    next = clearWaterForDate(next, date);
    next = markWateredManually(next, date, worldData);
  } else if (choice.waterElsewhere === "half") {
    next = clearWaterForDate(next, date);
    next = markWateredHalf(next, date, worldData);
  } else {
    next = applyWaterFromInventoryCounts(
      next,
      date,
      worldData,
      choice.waterItemCounts
    );
  }

  return next;
}

export function characterNeedsDmEndOfDaySupplies(
  ownerUserId: string | null,
  dmUserId: string | null
): boolean {
  if (!dmUserId) return ownerUserId === null;
  return ownerUserId === null || ownerUserId === dmUserId;
}
