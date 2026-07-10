import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inventoryStackKey } from "@/lib/character/inventory-stack";
import {
  applyAmmoRefillToInventory,
  autoLoadAmmoContainers,
  canRefillAmmoContainers,
  computeAmmoRefill,
  consumeLoadedAmmunition,
  countBattleReadyAmmunition,
  countLooseAmmunition,
  distributePickedUpAmmo,
  findBattleAmmunitionContainer,
  getTotalContainerCapacity,
  unloadAmmoContainers,
} from "@/lib/dnd/ammunition";
import type { InventoryItem } from "@/lib/schemas/character";
import { getContainerProperties, type Item } from "@/lib/schemas/item";

function inv(partial: Partial<InventoryItem> & { id: string }): InventoryItem {
  return {
    itemId: undefined,
    name: "",
    quantity: 1,
    equipped: false,
    wieldMain: false,
    wieldOff: false,
    attuned: false,
    magicItem: false,
    notes: "",
    loadedQuantity: 0,
    ...partial,
  };
}

function catalogItem(slug: string, props: Record<string, unknown> = {}): Item {
  return {
    id: slug,
    slug,
    name: slug,
    category: "adventuring_gear",
    source: "SRD",
    rarity: "common",
    description: "",
    properties: props,
    requires_attunement: false,
    is_magic: false,
  };
}

const catalog: Record<string, Item> = {
  quiver: catalogItem("quiver", { capacity: 20, acceptsItemSlug: "arrow" }),
  "case-crossbow": catalogItem("case-crossbow", {
    capacity: 20,
    acceptsItemSlug: "crossbow-bolt",
  }),
  arrow: catalogItem("arrow"),
  "crossbow-bolt": catalogItem("crossbow-bolt"),
};

describe("getContainerProperties", () => {
  it("reads structured properties from catalog", () => {
    const props = getContainerProperties(catalog.quiver);
    assert.equal(props?.capacity, 20);
    assert.equal(props?.acceptsItemSlug, "arrow");
  });

  it("falls back to slug defaults when properties are empty", () => {
    const bare = catalogItem("quiver");
    const props = getContainerProperties(bare);
    assert.equal(props?.capacity, 20);
    assert.equal(props?.acceptsItemSlug, "arrow");
  });
});

describe("autoLoadAmmoContainers", () => {
  it("loads loose arrows into a quiver up to capacity", () => {
    const items = [
      inv({ id: "q1", itemId: "quiver", name: "Quiver" }),
      inv({ id: "a1", itemId: "arrow", name: "Arrow", quantity: 30 }),
    ];
    const next = autoLoadAmmoContainers(items, catalog);
    const quiver = next.find((i) => i.id === "q1");
    const arrows = next.find((i) => i.itemId === "arrow");
    assert.equal(quiver?.loadedQuantity, 20);
    assert.equal(arrows?.quantity, 10);
    assert.equal(countBattleReadyAmmunition(next, "arrow", catalog), 20);
  });

  it("fills multiple quivers", () => {
    const items = [
      inv({ id: "q1", itemId: "quiver" }),
      inv({ id: "q2", itemId: "quiver" }),
      inv({ id: "a1", itemId: "arrow", quantity: 50 }),
    ];
    const next = autoLoadAmmoContainers(items, catalog);
    assert.equal(getTotalContainerCapacity(next, "arrow", catalog), 40);
    assert.equal(countBattleReadyAmmunition(next, "arrow", catalog), 40);
    assert.equal(countBattleReadyAmmunition(items, "arrow", catalog), 0);
  });

  it("leaves battle ammo at zero without a container", () => {
    const items = [inv({ id: "a1", itemId: "arrow", quantity: 20 })];
    const next = autoLoadAmmoContainers(items, catalog);
    assert.equal(countBattleReadyAmmunition(next, "arrow", catalog), 0);
    assert.equal(next[0].quantity, 20);
  });
});

describe("consumeLoadedAmmunition", () => {
  it("decrements loadedQuantity without removing the container", () => {
    const items = [inv({ id: "q1", itemId: "quiver", loadedQuantity: 5 })];
    const next = consumeLoadedAmmunition(items, "q1");
    assert.equal(next[0].loadedQuantity, 4);
    assert.equal(next[0].quantity, 1);
  });
});

describe("findBattleAmmunitionContainer", () => {
  it("returns the first container with loaded ammo", () => {
    const items = [
      inv({ id: "q1", itemId: "quiver", loadedQuantity: 0 }),
      inv({ id: "q2", itemId: "quiver", loadedQuantity: 3 }),
    ];
    const found = findBattleAmmunitionContainer(items, "arrow", catalog);
    assert.equal(found?.id, "q2");
  });
});

describe("ammo refill", () => {
  it("previews and applies refill from loose reserve", () => {
    const items = [
      inv({ id: "q1", itemId: "quiver", loadedQuantity: 12 }),
      inv({ id: "a1", itemId: "arrow", quantity: 15 }),
    ];
    const previews = computeAmmoRefill(items, catalog);
    assert.equal(previews.length, 1);
    assert.equal(previews[0].totalMoved, 8);
    assert.equal(previews[0].containers[0].afterLoaded, 20);

    const next = applyAmmoRefillToInventory(items, catalog);
    assert.equal(next.find((i) => i.id === "q1")?.loadedQuantity, 20);
    assert.equal(next.find((i) => i.itemId === "arrow")?.quantity, 7);
    assert.equal(canRefillAmmoContainers(next, catalog), false);
  });
});

describe("distributePickedUpAmmo", () => {
  it("auto-loads into quiver then overflows to loose", () => {
    const items = [inv({ id: "q1", itemId: "quiver", loadedQuantity: 18 })];
    const next = distributePickedUpAmmo(items, "arrow", 5, catalog);
    assert.equal(next.find((i) => i.id === "q1")?.loadedQuantity, 20);
    assert.equal(next.find((i) => i.itemId === "arrow")?.quantity, 3);
  });
});

describe("unloadAmmoContainers", () => {
  it("returns loaded ammo to loose stacks", () => {
    const items = [
      inv({ id: "q1", itemId: "quiver", loadedQuantity: 15 }),
      inv({ id: "a1", itemId: "arrow", quantity: 3 }),
    ];
    const next = unloadAmmoContainers(items, catalog);
    assert.equal(next.find((i) => i.id === "q1")?.loadedQuantity, 0);
    assert.equal(countLooseAmmunition(next, "arrow"), 18);
  });
});

describe("inventoryStackKey", () => {
  it("does not merge quivers with loaded ammo", () => {
    const loaded = inv({ id: "q1", itemId: "quiver", loadedQuantity: 5 });
    const empty = inv({ id: "q2", itemId: "quiver", loadedQuantity: 0 });
    assert.equal(inventoryStackKey(loaded), null);
    assert.equal(inventoryStackKey(empty), "catalog:quiver");
  });
});
