import type { InventoryItem } from "@/lib/schemas/character";
import type { Item } from "@/lib/schemas/item";
import { getWeaponProperties } from "@/lib/schemas/item";

const RECOVERABLE_AMMUNITION_SLUGS = new Set(["arrow", "crossbow-bolt"]);

export function isRecoverableAmmunition(slug: string): boolean {
  return RECOVERABLE_AMMUNITION_SLUGS.has(slug.trim().toLowerCase());
}

const WEAPON_AMMUNITION_SLUGS: Record<string, string> = {
  blowgun: "blowgun-needle",
  longbow: "arrow",
  shortbow: "arrow",
  "crossbow-hand": "crossbow-bolt",
  "crossbow-heavy": "crossbow-bolt",
  "crossbow-light": "crossbow-bolt",
  sling: "sling-bullet",
};

export function getAmmunitionSlugForWeapon(weaponSlug: string): string | null {
  const normalized = weaponSlug.trim().toLowerCase();
  if (WEAPON_AMMUNITION_SLUGS[normalized]) {
    return WEAPON_AMMUNITION_SLUGS[normalized];
  }
  if (normalized.includes("crossbow")) return "crossbow-bolt";
  if (normalized.endsWith("bow")) return "arrow";
  return null;
}

export function weaponUsesAmmunition(catalogItem: Item): boolean {
  const properties = getWeaponProperties(catalogItem);
  if (!properties) return false;
  return properties.weaponProperties.includes("ammunition");
}

/** Thrown weapons (javelin, handaxe, etc.) leave the thrower's inventory when used. */
export function weaponConsumesSelfWhenThrown(catalogItem: Item): boolean {
  const properties = getWeaponProperties(catalogItem);
  if (!properties) return false;
  if (!properties.weaponProperties.includes("thrown")) return false;
  if (
    properties.weaponRange === "ranged" &&
    properties.weaponProperties.includes("ammunition")
  ) {
    return false;
  }
  return true;
}

export function findInventoryStack(
  items: InventoryItem[],
  inventoryStackId: string
): InventoryItem | null {
  return items.find((item) => item.quantity > 0 && item.id === inventoryStackId) ?? null;
}

export function countAmmunitionInInventory(
  items: InventoryItem[],
  ammunitionItemId: string
): number {
  return items.reduce((total, item) => {
    if (item.quantity <= 0 || item.itemId !== ammunitionItemId) return total;
    return total + item.quantity;
  }, 0);
}

export function findAmmunitionStack(
  items: InventoryItem[],
  ammunitionItemId: string
): InventoryItem | null {
  return (
    items.find((item) => item.quantity > 0 && item.itemId === ammunitionItemId) ?? null
  );
}

export function getAmmunitionDisplayName(
  ammunitionItemId: string,
  catalogItems: Record<string, Item>
): string {
  return catalogItems[ammunitionItemId]?.name ?? ammunitionItemId;
}

export function formatAmmunitionLine(name: string, count: number): string {
  const label = count === 1 ? name : `${name}s`;
  return `Ammunition: ${count} ${label}`;
}

export function formatAmmunitionConsumptionLine(name: string, quantity = 1): string {
  const label = quantity === 1 ? name : `${name}s`;
  return `Consumes ${quantity} ${label}`;
}

export function formatThrownWeaponLine(name: string, count: number): string {
  const label = count === 1 ? name : `${name}s`;
  return `Inventory: ${count} ${label}`;
}

export function formatThrownWeaponConsumptionLine(name: string, count = 1): string {
  return formatThrownWeaponLine(name, count);
}
