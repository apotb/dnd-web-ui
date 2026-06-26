import type { InventoryItem } from "@/lib/schemas/character";
import type { Item } from "@/lib/schemas/item";
import { formatItemCostGp } from "@/lib/schemas/item";

export const BACKPACK_ITEM_SLUG = "backpack";
export const BACKPACK_CARRY_CAPACITY_BONUS_LB = 30;

export const ENCUMBERED_SPEED_FT = 5;

export type EncumbranceStatus = "normal" | "encumbered" | "overloaded";

export interface EncumbranceInfo {
  weightLb: number;
  /** Comfortable carry limit (Strength × 15). */
  carryCapacityLb: number;
  /** Push/drag/lift limit (Strength × 30). */
  maxCapacityLb: number;
  status: EncumbranceStatus;
  /** Speed after encumbrance (5 ft when encumbered or overloaded). */
  effectiveSpeedFt: number;
}

export function getNormalCarryCapacityLb(strength: number): number {
  return Math.max(0, strength) * 15;
}

export function getMaxCarryCapacityLb(strength: number): number {
  return Math.max(0, strength) * 30;
}

export interface CarryCapacitySource {
  label: string;
  value: number;
}

export interface CarryCapacityBreakdown {
  strengthScore: number;
  carryCapacityLb: number;
  maxCapacityLb: number;
  sources: CarryCapacitySource[];
}

function isBackpackItem(
  item: InventoryItem,
  catalogItem: Item | null | undefined
): boolean {
  if (item.itemId === BACKPACK_ITEM_SLUG) return true;
  if (catalogItem?.slug === BACKPACK_ITEM_SLUG) return true;
  return item.name.trim().toLowerCase() === "backpack";
}

function countBackpacksInInventory(
  items: InventoryItem[],
  catalogItems: Record<string, Item>
): number {
  return items.reduce((count, item) => {
    const catalog = item.itemId ? catalogItems[item.itemId] : null;
    if (!isBackpackItem(item, catalog)) return count;
    return count + Math.max(0, item.quantity || 0);
  }, 0);
}

export function calculateCarryCapacityBreakdown(
  strength: number,
  items: InventoryItem[],
  catalogItems: Record<string, Item>
): CarryCapacityBreakdown {
  const strengthScore = Math.max(0, strength);
  const strengthCapacity = getNormalCarryCapacityLb(strengthScore);
  const strengthMax = getMaxCarryCapacityLb(strengthScore);
  const sources: CarryCapacitySource[] = [
    { label: "Strength", value: strengthCapacity },
  ];

  const backpackCount = countBackpacksInInventory(items, catalogItems);
  let bonus = 0;
  if (backpackCount > 0) {
    bonus = backpackCount * BACKPACK_CARRY_CAPACITY_BONUS_LB;
    sources.push({
      label: backpackCount > 1 ? `Backpack (×${backpackCount})` : "Backpack",
      value: bonus,
    });
  }

  return {
    strengthScore,
    carryCapacityLb: strengthCapacity + bonus,
    maxCapacityLb: strengthMax + bonus,
    sources,
  };
}

export function formatCarryCapacityTooltip(
  breakdown: CarryCapacityBreakdown
): string | null {
  if (!breakdown.sources.length) return null;
  return breakdown.sources
    .map((source) => {
      const weight = formatWeightLb(source.value);
      if (source.label === "Strength") {
        return `${source.label}: ${breakdown.strengthScore} × 15 = ${weight}`;
      }
      if (source.label === "Backpack" || source.label.startsWith("Backpack (×")) {
        return `${source.label}: +${weight}`;
      }
      return `${source.label}: ${weight}`;
    })
    .join("\n");
}

export function resolveItemWeightLb(
  item: InventoryItem,
  catalogItem: Item | null | undefined
): number {
  if (item.weightLb != null) return item.weightLb;
  if (catalogItem?.weight_lb != null) return catalogItem.weight_lb;
  return 0;
}

export function getItemStackWeightLb(
  item: InventoryItem,
  catalogItems: Record<string, Item>
): number {
  const catalog = item.itemId ? catalogItems[item.itemId] : null;
  const unitWeight = resolveItemWeightLb(item, catalog ?? null);
  return unitWeight * Math.max(0, item.quantity || 0);
}

export function getInventoryWeightLb(
  items: InventoryItem[],
  catalogItems: Record<string, Item>
): number {
  return items.reduce(
    (sum, item) => sum + getItemStackWeightLb(item, catalogItems),
    0
  );
}

export function getEncumbranceInfo(
  strength: number,
  weightLb: number,
  baseSpeedFt: number,
  carryCapacityBreakdown?: CarryCapacityBreakdown
): EncumbranceInfo {
  const breakdown =
    carryCapacityBreakdown ??
    calculateCarryCapacityBreakdown(strength, [], {});
  const { carryCapacityLb, maxCapacityLb } = breakdown;

  let status: EncumbranceStatus = "normal";
  if (weightLb > maxCapacityLb) status = "overloaded";
  else if (weightLb > carryCapacityLb) status = "encumbered";

  const effectiveSpeedFt =
    status === "normal" ? baseSpeedFt : ENCUMBERED_SPEED_FT;

  return {
    weightLb,
    carryCapacityLb,
    maxCapacityLb,
    status,
    effectiveSpeedFt,
  };
}

export function formatWeightLb(lb: number): string {
  const rounded = Math.round(lb * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} lb`;
}

export function formatCarryCapacityLabel(
  weightLb: number,
  carryCapacityLb: number
): string {
  return `${formatWeightLb(weightLb)} / ${formatWeightLb(carryCapacityLb)}`;
}

export function formatInventoryItemWeightLine(
  unitWeightLb: number,
  quantity: number
): string | null {
  if (unitWeightLb <= 0) return null;
  const unit = formatWeightLb(unitWeightLb);
  if (quantity > 1) {
    return `${unit} (${formatWeightLb(unitWeightLb * quantity)} total)`;
  }
  return unit;
}

/** Tooltip text for custom (non-catalog) inventory rows. */
export function formatCustomInventoryItemTooltip(
  item: InventoryItem
): string | null {
  const lines: string[] = [];
  const name = item.name.trim();
  if (name) {
    lines.push(name);
  }
  const weightLb = item.weightLb;
  if (weightLb != null) {
    lines.push(`Weight: ${weightLb} lb`);
  }
  if (item.costGp != null) {
    lines.push(`Cost: ${formatItemCostGp(item.costGp)}`);
  }
  const notes = item.notes.trim();
  if (notes) {
    if (lines.length) lines.push("");
    lines.push(notes);
  }
  return lines.length ? lines.join("\n") : null;
}

export function canCarryAdditionalWeight(
  currentWeightLb: number,
  additionalLb: number,
  strength: number,
  items: InventoryItem[] = [],
  catalogItems: Record<string, Item> = {}
): boolean {
  const { maxCapacityLb } = calculateCarryCapacityBreakdown(
    strength,
    items,
    catalogItems
  );
  return currentWeightLb + additionalLb <= maxCapacityLb;
}

export function isInventoryWithinMaxCapacity(
  items: InventoryItem[],
  catalogItems: Record<string, Item>,
  strength: number
): boolean {
  const weightLb = getInventoryWeightLb(items, catalogItems);
  const { maxCapacityLb } = calculateCarryCapacityBreakdown(
    strength,
    items,
    catalogItems
  );
  return weightLb <= maxCapacityLb;
}
