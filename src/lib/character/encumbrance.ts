import type { InventoryItem } from "@/lib/schemas/character";
import type { Item } from "@/lib/schemas/item";

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
  baseSpeedFt: number
): EncumbranceInfo {
  const carryCapacityLb = getNormalCarryCapacityLb(strength);
  const maxCapacityLb = getMaxCarryCapacityLb(strength);

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

export function canCarryAdditionalWeight(
  currentWeightLb: number,
  additionalLb: number,
  strength: number
): boolean {
  return currentWeightLb + additionalLb <= getMaxCarryCapacityLb(strength);
}

export function formatEncumbranceSpeedTooltip(
  info: EncumbranceInfo,
  baseSpeedFt: number
): string | null {
  if (info.status === "normal") return null;
  if (info.status === "overloaded") {
    return `Carrying ${formatWeightLb(info.weightLb)} (max ${formatWeightLb(info.maxCapacityLb)}). Speed reduced to ${ENCUMBERED_SPEED_FT} ft.`;
  }
  return `Carrying ${formatWeightLb(info.weightLb)} (comfort limit ${formatWeightLb(info.carryCapacityLb)}). Speed reduced from ${baseSpeedFt} ft to ${ENCUMBERED_SPEED_FT} ft.`;
}
