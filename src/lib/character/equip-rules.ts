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

export interface UnequipPreviewEntry {
  name: string;
  detail?: string;
}

function diffUnequippedOnEquip(
  before: InventoryItem[],
  after: InventoryItem[],
  excludeIndex: number,
  catalogItems: Record<string, Item>
): UnequipPreviewEntry[] {
  const entries: UnequipPreviewEntry[] = [];

  for (let i = 0; i < before.length; i++) {
    if (i === excludeIndex) continue;
    const previous = before[i];
    const next = after[i];
    const catalog = resolveCatalog(previous, catalogItems);
    const slot = getItemEquipSlot(catalog, previous);
    const name = inventoryDisplayName(previous, catalog);
    if (!name) continue;

    if (slot === "weapon") {
      const hadMain = getEffectiveWieldMain(previous, catalog);
      const hasMain = getEffectiveWieldMain(next, catalog);
      const hadOff = getEffectiveWieldOff(previous);
      const hasOff = getEffectiveWieldOff(next);

      if (hadMain && !hasMain) entries.push({ name, detail: "main hand" });
      if (hadOff && !hasOff) entries.push({ name, detail: "off-hand" });
    } else if (previous.equipped && !next.equipped) {
      entries.push({ name });
    }
  }

  return entries;
}

/** Items that would be unequipped when equipping armor or a shield. */
export function getUnequipPreviewOnEquip(
  items: InventoryItem[],
  index: number,
  catalogItems: Record<string, Item>,
  speciesDisplayName = ""
): UnequipPreviewEntry[] | null {
  const target = items[index];
  if (!target || target.equipped) return null;

  const targetCatalog = resolveCatalog(target, catalogItems);
  const targetSlot = getItemEquipSlot(targetCatalog, target);
  if (!targetSlot || targetSlot === "weapon") return null;
  if (
    targetSlot === "armor" &&
    hasNaturalArmorSpecies(speciesDisplayName)
  ) {
    return null;
  }

  const after = setItemEquipped(items, index, true, catalogItems, speciesDisplayName);
  const entries = diffUnequippedOnEquip(items, after, index, catalogItems);
  return entries.length > 0 ? entries : null;
}

/** Items that would be unequipped when wielding a weapon in a hand. */
export function getUnequipPreviewOnWield(
  items: InventoryItem[],
  index: number,
  hand: WeaponHand,
  catalogItems: Record<string, Item>
): UnequipPreviewEntry[] | null {
  const target = items[index];
  if (!target) return null;

  const targetCatalog = resolveCatalog(target, catalogItems);
  if (getItemEquipSlot(targetCatalog, target) !== "weapon") return null;

  const alreadyWielded =
    hand === "main"
      ? getEffectiveWieldMain(target, targetCatalog)
      : getEffectiveWieldOff(target);
  if (alreadyWielded) return null;

  if (hand === "off" && !canWieldOffHand(items, index, catalogItems)) return null;
  if (hand === "main" && !canWieldMainHand(items, index, catalogItems)) return null;

  const after = setWeaponWield(items, index, hand, true, catalogItems);
  if (after === items) return null;

  const entries = diffUnequippedOnEquip(items, after, index, catalogItems);
  return entries.length > 0 ? entries : null;
}

export function formatUnequipPreviewTooltip(
  entries: UnequipPreviewEntry[] | null | undefined
): string | null {
  if (!entries || entries.length === 0) return null;
  const lines = entries.map((entry) =>
    entry.detail ? `${entry.name} (${entry.detail})` : entry.name
  );
  if (lines.length === 1) return `Will unequip: ${lines[0]}`;
  return `Will unequip:\n${lines.join("\n")}`;
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

export function isOneHandedWeapon(catalogItem: Item | null | undefined): boolean {
  if (!catalogItem) return false;
  if (catalogItem.category !== "weapon") return false;
  return !isTwoHandedWeapon(catalogItem);
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

function hasTwoHandedMainHandWeapon(
  items: InventoryItem[],
  catalogItems: Record<string, Item>
): boolean {
  return items.some((item) => {
    const catalog = resolveCatalog(item, catalogItems);
    return getEffectiveWieldMain(item, catalog) && isTwoHandedWeapon(catalog);
  });
}

/** Decrement quantity and clear the thrown hand's wield flag when the row remains. */
export function consumeThrownWeaponInventoryItem(
  items: InventoryItem[],
  inventoryItemId: string,
  fromOffHand: boolean
): InventoryItem[] {
  return items.flatMap((item) => {
    if (item.id !== inventoryItemId) return [item];

    const quantity = item.quantity - 1;
    if (quantity <= 0) return [];

    const unequipped = {
      ...item,
      quantity,
      wieldMain: fromOffHand ? item.wieldMain : false,
      wieldOff: fromOffHand ? false : item.wieldOff,
    };
    return [syncWeaponEquipped(unequipped)];
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
  if (!isOneHandedWeapon(catalog)) return false;
  if (hasShieldEquipped(items, catalogItems)) return false;
  if (hasTwoHandedMainHandWeapon(items, catalogItems)) return false;
  if (stackQuantity(item) < 2 && getEffectiveWieldMain(item, catalog)) return false;

  return true;
}

/** Whether main-hand can be toggled on for this weapon row. */
export function canWieldMainHand(
  items: InventoryItem[],
  index: number,
  catalogItems: Record<string, Item>
): boolean {
  const item = items[index];
  if (!item) return false;

  const catalog = resolveCatalog(item, catalogItems);
  if (getItemEquipSlot(catalog, item) !== "weapon") return false;
  if (stackQuantity(item) < 2 && item.wieldOff) return false;

  return true;
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
    next[index] = syncWeaponEquipped({
      ...next[index],
      wieldMain: hand === "main" ? false : next[index].wieldMain,
      wieldOff: hand === "off" ? false : next[index].wieldOff,
    });
    return next;
  }

  if (hand === "off") {
    if (!canWieldOffHand(next, index, catalogItems)) {
      return items;
    }
  }

  if (hand === "main" && !canWieldMainHand(next, index, catalogItems)) {
    return items;
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

  const sanitized = migrated.map((item, index) => {
    const catalog = item.itemId ? catalogItems[item.itemId] ?? null : null;
    const slot = getItemEquipSlot(catalog, item);

    if (slot === "weapon") {
      if (item.itemId && !catalog) return syncWeaponEquipped(item);
      if (!isEquippableItem(catalog, item)) return clearWeaponWield(item);
      if (stackQuantity(item) < 2 && item.wieldMain && item.wieldOff) {
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

  return sanitized.map((item, index) => {
    const catalog = item.itemId ? catalogItems[item.itemId] ?? null : null;
    if (getItemEquipSlot(catalog, item) !== "weapon") return item;
    if (item.wieldOff && !canWieldOffHand(sanitized, index, catalogItems)) {
      return syncWeaponEquipped({ ...item, wieldOff: false });
    }
    return item;
  });
}
