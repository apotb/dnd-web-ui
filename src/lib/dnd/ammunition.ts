import type { InventoryItem } from "@/lib/schemas/character";
import type { Item } from "@/lib/schemas/item";
import { getWeaponProperties } from "@/lib/schemas/item";

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
