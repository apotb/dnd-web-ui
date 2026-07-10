import { mergeIntoInventory } from "@/lib/character/inventory-stack";
import type { InventoryItem } from "@/lib/schemas/character";
import {
  getContainerProperties,
  getWeaponProperties,
  type ContainerProperties,
  type Item,
} from "@/lib/schemas/item";

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

export function formatBattleAmmunitionLine(
  name: string,
  loaded: number,
  capacity: number
): string {
  const label = loaded === 1 ? name : `${name}s`;
  return `Ammunition: ${loaded}/${capacity} ${label}`;
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

// ── Ammo containers (quiver / bolt case) ──

export interface AmmoContainerRow {
  inventoryItem: InventoryItem;
  containerProps: ContainerProperties;
  catalogItem: Item;
}

function getContainerPropsForInventoryItem(
  item: InventoryItem,
  catalogItems: Record<string, Item>
): ContainerProperties | null {
  if (!item.itemId || item.quantity <= 0) return null;
  const catalogItem = catalogItems[item.itemId];
  if (!catalogItem) return null;
  return getContainerProperties(catalogItem);
}

export function isAmmoContainerInventoryItem(
  item: InventoryItem,
  catalogItems: Record<string, Item>
): boolean {
  return getContainerPropsForInventoryItem(item, catalogItems) != null;
}

export function getAmmoContainers(
  items: InventoryItem[],
  ammunitionItemId: string,
  catalogItems: Record<string, Item>
): AmmoContainerRow[] {
  const slug = ammunitionItemId.trim().toLowerCase();
  const rows: AmmoContainerRow[] = [];

  for (const item of items) {
    if (item.quantity <= 0 || !item.itemId) continue;
    const catalogItem = catalogItems[item.itemId];
    if (!catalogItem) continue;
    const containerProps = getContainerProperties(catalogItem);
    if (!containerProps || containerProps.acceptsItemSlug !== slug) continue;
    rows.push({ inventoryItem: item, containerProps, catalogItem });
  }

  return rows;
}

export function getTotalContainerCapacity(
  items: InventoryItem[],
  ammunitionItemId: string,
  catalogItems: Record<string, Item>
): number {
  return getAmmoContainers(items, ammunitionItemId, catalogItems).reduce(
    (total, row) => total + row.containerProps.capacity * row.inventoryItem.quantity,
    0
  );
}

export function countBattleReadyAmmunition(
  items: InventoryItem[],
  ammunitionItemId: string,
  catalogItems: Record<string, Item>
): number {
  return getAmmoContainers(items, ammunitionItemId, catalogItems).reduce(
    (total, row) => total + row.inventoryItem.loadedQuantity * row.inventoryItem.quantity,
    0
  );
}

export function countLooseAmmunition(
  items: InventoryItem[],
  ammunitionItemId: string
): number {
  return countAmmunitionInInventory(items, ammunitionItemId);
}

export function findBattleAmmunitionContainer(
  items: InventoryItem[],
  ammunitionItemId: string,
  catalogItems: Record<string, Item>
): InventoryItem | null {
  for (const row of getAmmoContainers(items, ammunitionItemId, catalogItems)) {
    if (row.inventoryItem.loadedQuantity > 0) {
      return row.inventoryItem;
    }
  }
  return null;
}

export function isLoadedAmmoContainer(
  item: InventoryItem,
  catalogItems: Record<string, Item>
): boolean {
  return isAmmoContainerInventoryItem(item, catalogItems) && item.loadedQuantity > 0;
}

export function consumeLoadedAmmunition(
  items: InventoryItem[],
  containerInventoryItemId: string
): InventoryItem[] {
  return items.map((item) => {
    if (item.id !== containerInventoryItemId) return item;
    return {
      ...item,
      loadedQuantity: Math.max(0, item.loadedQuantity - 1),
    };
  });
}

function countLooseAmmoStacks(
  items: InventoryItem[],
  ammunitionItemId: string
): number {
  return countLooseAmmunition(items, ammunitionItemId);
}

function decrementLooseAmmo(
  items: InventoryItem[],
  ammunitionItemId: string,
  amount: number
): InventoryItem[] {
  let remaining = amount;
  const next = [...items];

  for (let i = 0; i < next.length && remaining > 0; i++) {
    const item = next[i];
    if (item.quantity <= 0 || item.itemId !== ammunitionItemId) continue;

    const take = Math.min(remaining, item.quantity);
    remaining -= take;
    const quantity = item.quantity - take;
    if (quantity <= 0) {
      next.splice(i, 1);
      i -= 1;
    } else {
      next[i] = { ...item, quantity };
    }
  }

  return next;
}

/** At battle start: transfer loose ammo into container loadedQuantity up to capacity. */
export function autoLoadAmmoContainers(
  items: InventoryItem[],
  catalogItems: Record<string, Item>
): InventoryItem[] {
  const ammoSlugs = new Set<string>();
  for (const item of items) {
    const props = getContainerPropsForInventoryItem(item, catalogItems);
    if (props) ammoSlugs.add(props.acceptsItemSlug);
  }

  let next = items.map((item) => ({ ...item }));

  for (const slug of ammoSlugs) {
    let looseRemaining = countLooseAmmoStacks(next, slug);
    if (looseRemaining <= 0) continue;

    let totalTransferred = 0;
    next = next.map((item) => {
      if (looseRemaining <= 0) return item;
      const props = getContainerPropsForInventoryItem(item, catalogItems);
      if (!props || props.acceptsItemSlug !== slug) return item;

      const maxLoad = props.capacity * item.quantity;
      const space = maxLoad - item.loadedQuantity;
      if (space <= 0) return item;

      const take = Math.min(space, looseRemaining);
      looseRemaining -= take;
      totalTransferred += take;
      return { ...item, loadedQuantity: item.loadedQuantity + take };
    });

    if (totalTransferred > 0) {
      next = decrementLooseAmmo(next, slug, totalTransferred);
    }
  }

  return next;
}

/** Return loaded ammo from quivers/cases back to loose inventory stacks. */
export function unloadAmmoContainers(
  items: InventoryItem[],
  catalogItems: Record<string, Item>
): InventoryItem[] {
  let next = items.map((item) => ({ ...item }));

  for (const item of items) {
    if (item.loadedQuantity <= 0) continue;
    const props = getContainerPropsForInventoryItem(item, catalogItems);
    if (!props) continue;

    const slug = props.acceptsItemSlug;
    const amount = item.loadedQuantity;
    next = next.map((row) =>
      row.id === item.id ? { ...row, loadedQuantity: 0 } : row
    );
    const catalogItem = catalogItems[slug];
    next = mergeIntoInventory(next, {
      id: crypto.randomUUID(),
      itemId: slug,
      name: catalogItem?.name ?? slug,
      quantity: amount,
      equipped: false,
      wieldMain: false,
      wieldOff: false,
      attuned: false,
      magicItem: false,
      notes: "",
      loadedQuantity: 0,
    });
  }

  return next;
}

export function characterHasLoadedAmmo(
  items: InventoryItem[],
  catalogItems: Record<string, Item>
): boolean {
  return items.some(
    (item) =>
      item.loadedQuantity > 0 &&
      getContainerPropsForInventoryItem(item, catalogItems) != null
  );
}

export interface AmmoRefillContainerPreview {
  containerId: string;
  containerName: string;
  beforeLoaded: number;
  afterLoaded: number;
  capacity: number;
  added: number;
}

export interface AmmoRefillPreview {
  ammoSlug: string;
  ammoName: string;
  looseAvailable: number;
  totalMoved: number;
  containers: AmmoRefillContainerPreview[];
}

export function computeAmmoRefill(
  items: InventoryItem[],
  catalogItems: Record<string, Item>
): AmmoRefillPreview[] {
  const previews: AmmoRefillPreview[] = [];
  const ammoSlugs = new Set<string>();

  for (const item of items) {
    const props = getContainerPropsForInventoryItem(item, catalogItems);
    if (props) ammoSlugs.add(props.acceptsItemSlug);
  }

  for (const slug of ammoSlugs) {
    let looseRemaining = countLooseAmmoStacks(items, slug);
    if (looseRemaining <= 0) continue;

    const containerPreviews: AmmoRefillContainerPreview[] = [];
    let totalMoved = 0;

    for (const row of getAmmoContainers(items, slug, catalogItems)) {
      if (looseRemaining <= 0) break;
      const { inventoryItem, containerProps, catalogItem } = row;
      const maxLoad = containerProps.capacity * inventoryItem.quantity;
      const space = maxLoad - inventoryItem.loadedQuantity;
      if (space <= 0) continue;

      const added = Math.min(space, looseRemaining);
      looseRemaining -= added;
      totalMoved += added;
      containerPreviews.push({
        containerId: inventoryItem.id,
        containerName: catalogItem.name,
        beforeLoaded: inventoryItem.loadedQuantity,
        afterLoaded: inventoryItem.loadedQuantity + added,
        capacity: maxLoad,
        added,
      });
    }

    if (totalMoved > 0) {
      previews.push({
        ammoSlug: slug,
        ammoName: getAmmunitionDisplayName(slug, catalogItems),
        looseAvailable: countLooseAmmoStacks(items, slug),
        totalMoved,
        containers: containerPreviews,
      });
    }
  }

  return previews;
}

export function applyAmmoRefillToInventory(
  items: InventoryItem[],
  catalogItems: Record<string, Item>
): InventoryItem[] {
  const previews = computeAmmoRefill(items, catalogItems);
  if (previews.length === 0) return items;

  let next = items.map((item) => ({ ...item }));

  for (const preview of previews) {
    for (const container of preview.containers) {
      next = next.map((item) => {
        if (item.id !== container.containerId) return item;
        return { ...item, loadedQuantity: container.afterLoaded };
      });
    }
    next = decrementLooseAmmo(next, preview.ammoSlug, preview.totalMoved);
  }

  return next;
}

export function canRefillAmmoContainers(
  items: InventoryItem[],
  catalogItems: Record<string, Item>
): boolean {
  return computeAmmoRefill(items, catalogItems).length > 0;
}

/** Auto-load picked-up ammo into containers; overflow goes to loose inventory. */
export function distributePickedUpAmmo(
  items: InventoryItem[],
  ammunitionItemId: string,
  quantity: number,
  catalogItems: Record<string, Item>
): InventoryItem[] {
  const slug = ammunitionItemId.trim().toLowerCase();
  let remaining = Math.max(1, quantity);
  let next = items.map((item) => ({ ...item }));

  for (const row of getAmmoContainers(next, slug, catalogItems)) {
    if (remaining <= 0) break;
    const maxLoad = row.containerProps.capacity * row.inventoryItem.quantity;
    const space = maxLoad - row.inventoryItem.loadedQuantity;
    if (space <= 0) continue;

    const added = Math.min(space, remaining);
    remaining -= added;
    next = next.map((item) => {
      if (item.id !== row.inventoryItem.id) return item;
      return { ...item, loadedQuantity: item.loadedQuantity + added };
    });
  }

  if (remaining > 0) {
    const catalogItem = catalogItems[slug];
    next = mergeIntoInventory(next, {
      id: crypto.randomUUID(),
      itemId: slug,
      name: catalogItem?.name ?? slug,
      quantity: remaining,
      equipped: false,
      wieldMain: false,
      wieldOff: false,
      attuned: false,
      magicItem: false,
      notes: "",
      loadedQuantity: 0,
    });
  }

  return next;
}
