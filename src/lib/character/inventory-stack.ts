import type { InventoryItem } from "@/lib/schemas/character";

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** Identity key for stackable inventory rows. Returns null when rows cannot merge. */
export function inventoryStackKey(item: InventoryItem): string | null {
  if (item.itemId) return `catalog:${item.itemId}`;
  const name = normalizeName(item.name);
  if (!name) return null;
  return `custom:${name}:${item.weightLb ?? ""}:${item.costGp ?? ""}:${item.notes.trim()}`;
}

/** Plain stacks only — equipped, wielded, or attuned rows stay separate. */
export function isPlainInventoryStack(item: InventoryItem): boolean {
  return !item.equipped && !item.wieldMain && !item.wieldOff && !item.attuned;
}

export function findMergeableStackIndex(
  items: InventoryItem[],
  incoming: InventoryItem
): number {
  const key = inventoryStackKey(incoming);
  if (!key) return -1;
  return items.findIndex(
    (item) => inventoryStackKey(item) === key && isPlainInventoryStack(item)
  );
}

/** Add an item to inventory, incrementing quantity when a matching stack exists. */
export function mergeIntoInventory(
  items: InventoryItem[],
  incoming: InventoryItem
): InventoryItem[] {
  const quantity = Math.max(1, incoming.quantity || 1);
  const index = findMergeableStackIndex(items, incoming);

  if (index === -1) {
    return [...items, { ...incoming, quantity }];
  }

  const next = [...items];
  next[index] = {
    ...next[index],
    quantity: next[index].quantity + quantity,
  };
  return next;
}

/** Assign fresh ids when duplicate inventory row ids are present. */
export function ensureUniqueInventoryIds(
  items: InventoryItem[]
): InventoryItem[] {
  const seen = new Set<string>();
  return items.map((item) => {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      return item;
    }
    const next = { ...item, id: crypto.randomUUID() };
    seen.add(next.id);
    return next;
  });
}
