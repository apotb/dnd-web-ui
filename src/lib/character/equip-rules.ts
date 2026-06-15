import type { InventoryItem } from "@/lib/schemas/character";
import { hasNaturalArmorSpecies } from "@/lib/dnd/phb/species-mechanics";
import {
  getWeaponProperties,
  type Item,
} from "@/lib/schemas/item";

export type EquipSlot = "weapon" | "armor" | "shield";
export type WeaponHand = "main" | "off";

/** PHB armor names for inventory items without catalog links. */
const LEGACY_ARMOR_NAMES = new Set([
  "padded armor",
  "leather armor",
  "studded leather armor",
  "studded leather",
  "hide armor",
  "chain shirt",
  "scale mail",
  "breastplate",
  "half plate",
  "ring mail",
  "chain mail",
  "splint armor",
  "plate armor",
]);

function isLegacyArmorName(name: string): boolean {
  const key = name.toLowerCase().trim();
  if (LEGACY_ARMOR_NAMES.has(key)) return true;
  if (key.endsWith(" armour")) {
    return LEGACY_ARMOR_NAMES.has(`${key.slice(0, -7)} armor`);
  }
  return key.includes(" armor") || key.includes(" armour");
}

function isLegacyShieldName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return lower === "shield" || lower.endsWith(" shield");
}

function resolveCatalog(
  invItem: InventoryItem,
  catalogItems: Record<string, Item>
): Item | null {
  return invItem.itemId ? catalogItems[invItem.itemId] ?? null : null;
}

function stackQuantity(item: InventoryItem): number {
  return Math.max(0, Number(item.quantity) || 0);
}

/** Which equipment slot an inventory row uses, if any. */
export function getItemEquipSlot(
  catalogItem: Item | null | undefined,
  invItem: InventoryItem
): EquipSlot | null {
  if (catalogItem) {
    if (catalogItem.category === "weapon") return "weapon";
    if (catalogItem.category === "armor") return "armor";
    if (catalogItem.category === "shield") return "shield";
    return null;
  }

  const name = invItem.name;
  if (isLegacyArmorName(name)) return "armor";
  if (isLegacyShieldName(name)) return "shield";
  return null;
}

export function isEquippableItem(
  catalogItem: Item | null | undefined,
  invItem: InventoryItem
): boolean {
  return getItemEquipSlot(catalogItem, invItem) !== null;
}

/** Whether the item can actually be equipped (for sort/UI), respecting natural armor. */
export function canEquipInventoryItem(
  catalogItem: Item | null | undefined,
  invItem: InventoryItem,
  speciesDisplayName = ""
): boolean {
  const slot = getItemEquipSlot(catalogItem, invItem);
  if (!slot) return false;
  if (slot === "armor" && hasNaturalArmorSpecies(speciesDisplayName)) return false;
  return true;
}

function inventoryDisplayName(
  item: InventoryItem,
  catalogItem: Item | null | undefined
): string {
  return (catalogItem?.name ?? item.name ?? "").trim();
}

/** Equippable items first (in use, then alpha), then other items alphabetically. */
export function sortInventoryForDisplay(
  items: InventoryItem[],
  catalogItems: Record<string, Item>,
  speciesDisplayName = ""
): { item: InventoryItem; index: number }[] {
  return [...items]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const catalogA = resolveCatalog(a.item, catalogItems);
      const catalogB = resolveCatalog(b.item, catalogItems);
      const equippableA = canEquipInventoryItem(catalogA, a.item, speciesDisplayName);
      const equippableB = canEquipInventoryItem(catalogB, b.item, speciesDisplayName);
      if (equippableA !== equippableB) return equippableA ? -1 : 1;

      const byName = inventoryDisplayName(a.item, catalogA).localeCompare(
        inventoryDisplayName(b.item, catalogB),
        undefined,
        { sensitivity: "base" }
      );
      if (byName !== 0) return byName;
      return a.index - b.index;
    });
}

export function isLightWeapon(catalogItem: Item | null | undefined): boolean {
  if (!catalogItem) return false;
  const props = getWeaponProperties(catalogItem);
  return props?.weaponProperties.includes("light") ?? false;
}

function isTwoHandedWeapon(catalogItem: Item | null | undefined): boolean {
  if (!catalogItem) return false;
  const props = getWeaponProperties(catalogItem);
  return props?.weaponProperties.includes("two-handed") ?? false;
}

/** Legacy saves: equipped weapon without wield flags counts as main hand. */
export function getEffectiveWieldMain(
  item: InventoryItem,
  catalogItem: Item | null | undefined
): boolean {
  if (item.wieldMain) return true;
  if (item.wieldOff) return false;
  const slot = getItemEquipSlot(catalogItem, item);
  return !!(slot === "weapon" && item.equipped);
}

export function getEffectiveWieldOff(item: InventoryItem): boolean {
  return !!item.wieldOff;
}

export function isWeaponWielded(
  item: InventoryItem,
  catalogItem: Item | null | undefined
): boolean {
  return getEffectiveWieldMain(item, catalogItem) || getEffectiveWieldOff(item);
}

/** Armor/shields use `equipped`; weapons use wield flags. */
export function isWornForAc(
  item: InventoryItem,
  catalogItem: Item | null | undefined
): boolean {
  const slot = getItemEquipSlot(catalogItem, item);
  if (slot === "weapon") return false;
  return !!item.equipped;
}

function syncWeaponEquipped(item: InventoryItem): InventoryItem {
  const wielded = item.wieldMain || item.wieldOff;
  return { ...item, equipped: wielded };
}

function clearWeaponWield(item: InventoryItem): InventoryItem {
  return { ...item, wieldMain: false, wieldOff: false, equipped: false };
}

function hasShieldEquipped(
  items: InventoryItem[],
  catalogItems: Record<string, Item>
): boolean {
  return items.some((item) => {
    if (!item.equipped) return false;
    const catalog = resolveCatalog(item, catalogItems);
    return getItemEquipSlot(catalog, item) === "shield";
  });
}

/** Whether off-hand can be toggled for this weapon row. */
export function canWieldOffHand(
  items: InventoryItem[],
  index: number,
  catalogItems: Record<string, Item>
): boolean {
  const item = items[index];
  if (!item) return false;

  const catalog = resolveCatalog(item, catalogItems);
  if (getItemEquipSlot(catalog, item) !== "weapon") return false;
  if (!isLightWeapon(catalog)) return false;
  if (hasShieldEquipped(items, catalogItems)) return false;

  for (let i = 0; i < items.length; i++) {
    const otherCatalog = resolveCatalog(items[i], catalogItems);
    if (getEffectiveWieldMain(items[i], otherCatalog) && isTwoHandedWeapon(otherCatalog)) {
      return false;
    }
  }

  // Two light weapons in one stack — off-hand needs main on this row first.
  if (stackQuantity(item) >= 2) {
    return getEffectiveWieldMain(item, catalog) || item.wieldOff;
  }

  return items.some((other, i) => {
    if (i === index) return false;
    const otherCatalog = resolveCatalog(other, catalogItems);
    return (
      getEffectiveWieldMain(other, otherCatalog) &&
      isLightWeapon(otherCatalog) &&
      getItemEquipSlot(otherCatalog, other) === "weapon"
    );
  });
}

/**
 * Toggle main or off-hand wielding for a weapon row.
 * Armor/shields use setItemEquipped instead.
 */
export function setWeaponWield(
  items: InventoryItem[],
  index: number,
  hand: WeaponHand,
  wield: boolean,
  catalogItems: Record<string, Item>
): InventoryItem[] {
  const target = items[index];
  if (!target) return items;

  const targetCatalog = resolveCatalog(target, catalogItems);
  if (getItemEquipSlot(targetCatalog, target) !== "weapon") return items;

  let next = items.map((item) => ({ ...item }));

  if (!wield) {
    const hadMain = next[index].wieldMain;
    next[index] = syncWeaponEquipped({
      ...next[index],
      wieldMain: hand === "main" ? false : next[index].wieldMain,
      wieldOff:
        hand === "off"
          ? false
          : hand === "main" && hadMain && next[index].wieldOff
            ? false
            : next[index].wieldOff,
    });
    return next;
  }

  if (hand === "off") {
    if (!isLightWeapon(targetCatalog) || !canWieldOffHand(next, index, catalogItems)) {
      return items;
    }
  }

  const targetIsTwoHanded = isTwoHandedWeapon(targetCatalog);

  for (let i = 0; i < next.length; i++) {
    if (i === index) continue;

    const otherCatalog = resolveCatalog(next[i], catalogItems);
    const otherSlot = getItemEquipSlot(otherCatalog, next[i]);

    if (otherSlot === "shield" && next[i].equipped && (hand === "off" || targetIsTwoHanded)) {
      next[i] = { ...next[i], equipped: false };
    }

    if (otherSlot !== "weapon") continue;

    if (targetIsTwoHanded) {
      next[i] = clearWeaponWield(next[i]);
      continue;
    }

    if (hand === "main" && getEffectiveWieldMain(next[i], otherCatalog)) {
      next[i] = syncWeaponEquipped({ ...next[i], wieldMain: false });
    }

    if (hand === "off" && next[i].wieldOff) {
      next[i] = syncWeaponEquipped({ ...next[i], wieldOff: false });
    }

    if (hand === "main" && isTwoHandedWeapon(otherCatalog) && isWeaponWielded(next[i], otherCatalog)) {
      next[i] = clearWeaponWield(next[i]);
    }
  }

  if (hand === "main" && targetIsTwoHanded) {
    for (let i = 0; i < next.length; i++) {
      if (i === index) continue;
      const otherCatalog = resolveCatalog(next[i], catalogItems);
      const otherSlot = getItemEquipSlot(otherCatalog, next[i]);
      if (otherSlot === "weapon") next[i] = clearWeaponWield(next[i]);
      if (otherSlot === "shield") next[i] = { ...next[i], equipped: false };
    }
  }

  if (hand === "off") {
    if (stackQuantity(next[index]) >= 2 && !next[index].wieldMain) {
      next[index] = { ...next[index], wieldMain: true };
    }
    for (let i = 0; i < next.length; i++) {
      if (i === index) continue;
      const otherCatalog = resolveCatalog(next[i], catalogItems);
      if (getItemEquipSlot(otherCatalog, next[i]) === "shield" && next[i].equipped) {
        next[i] = { ...next[i], equipped: false };
      }
    }
  }

  next[index] = syncWeaponEquipped({
    ...next[index],
    wieldMain: hand === "main" ? true : next[index].wieldMain,
    wieldOff: hand === "off" ? true : next[index].wieldOff,
  });

  return next;
}

/**
 * Equip or unequip armor/shield.
 * Shields occupy the off hand and clear off-hand weapons.
 */
export function setItemEquipped(
  items: InventoryItem[],
  index: number,
  equipped: boolean,
  catalogItems: Record<string, Item>,
  speciesDisplayName = ""
): InventoryItem[] {
  const target = items[index];
  if (!target) return items;

  const targetCatalog = resolveCatalog(target, catalogItems);
  const targetSlot = getItemEquipSlot(targetCatalog, target);
  if (!targetSlot || targetSlot === "weapon") return items;

  if (
    equipped &&
    targetSlot === "armor" &&
    hasNaturalArmorSpecies(speciesDisplayName)
  ) {
    return items;
  }

  const next = items.map((item) => ({ ...item }));

  if (!equipped) {
    next[index] = { ...next[index], equipped: false };
    return next;
  }

  for (let i = 0; i < next.length; i++) {
    if (i === index || !next[i].equipped) continue;

    const otherCatalog = resolveCatalog(next[i], catalogItems);
    const otherSlot = getItemEquipSlot(otherCatalog, next[i]);
    if (!otherSlot) continue;

    if (otherSlot === "armor" && targetSlot === "armor") {
      next[i] = { ...next[i], equipped: false };
    }

    if (otherSlot === "shield" && targetSlot === "shield") {
      next[i] = { ...next[i], equipped: false };
    }
  }

  if (targetSlot === "shield") {
    for (let i = 0; i < next.length; i++) {
      if (i === index) continue;
      const otherCatalog = resolveCatalog(next[i], catalogItems);
      if (isTwoHandedWeapon(otherCatalog) && isWeaponWielded(next[i], otherCatalog)) {
        next[i] = clearWeaponWield(next[i]);
      }
      if (next[i].wieldOff) {
        next[i] = syncWeaponEquipped({ ...next[i], wieldOff: false });
      }
    }
  }

  next[index] = { ...next[index], equipped: true };
  return next;
}

/** Migrate legacy `equipped` on weapons to wieldMain. */
export function migrateInventoryWieldSlots(
  items: InventoryItem[],
  catalogItems: Record<string, Item> = {}
): InventoryItem[] {
  return items.map((item) => {
    const catalog = item.itemId ? catalogItems[item.itemId] ?? null : null;
    const slot = getItemEquipSlot(catalog, item);

    if (slot === "weapon") {
      if (item.wieldMain || item.wieldOff) {
        return syncWeaponEquipped(item);
      }
      if (item.equipped) {
        return { ...item, wieldMain: true, wieldOff: false, equipped: true };
      }
      return { ...item, wieldMain: false, wieldOff: false, equipped: false };
    }

    // Catalog not loaded — preserve wield flags for catalog-linked weapons.
    if (slot === null && item.itemId && (item.wieldMain || item.wieldOff || item.equipped)) {
      if (!item.wieldMain && !item.wieldOff && item.equipped) {
        return { ...item, wieldMain: true, wieldOff: false, equipped: true };
      }
      return syncWeaponEquipped(item);
    }

    return { ...item, wieldMain: false, wieldOff: false };
  });
}

/** Strip invalid equip/wield state. */
export function sanitizeEquippedItems(
  items: InventoryItem[],
  catalogItems: Record<string, Item> = {},
  speciesDisplayName = ""
): InventoryItem[] {
  const migrated = migrateInventoryWieldSlots(items, catalogItems);
  const blockArmor = hasNaturalArmorSpecies(speciesDisplayName);

  return migrated.map((item) => {
    const catalog = item.itemId ? catalogItems[item.itemId] ?? null : null;
    const slot = getItemEquipSlot(catalog, item);

    if (slot === "weapon") {
      if (item.itemId && !catalog) return syncWeaponEquipped(item);
      if (!isEquippableItem(catalog, item)) return clearWeaponWield(item);
      if (item.wieldOff && !isLightWeapon(catalog)) {
        return syncWeaponEquipped({ ...item, wieldOff: false });
      }
      return syncWeaponEquipped(item);
    }

    if (!item.equipped) return item;
    if (blockArmor && slot === "armor") {
      return { ...item, equipped: false, wieldMain: false, wieldOff: false };
    }
    if (item.itemId && !catalog) return item;
    if (isEquippableItem(catalog, item)) return { ...item, wieldMain: false, wieldOff: false };
    return { ...item, equipped: false, wieldMain: false, wieldOff: false };
  });
}
