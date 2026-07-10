import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CharacterData, InventoryItem } from "@/lib/schemas/character";
import type { Item } from "@/lib/schemas/item";
import { getSpellMaterialSpec } from "./spell-material-requirements";
import {
  buildMaterialCastPlan,
  characterHasSpellcastingFocus,
  consumeSpellMaterials,
  resolveSpellMaterialEligibility,
} from "./spell-materials";

function baseCharacter(items: InventoryItem[]): CharacterData {
  return {
    spells: {
      spellcastingAbility: "intelligence",
      known: [],
      slots: {},
    },
    inventory: { currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, items },
  } as unknown as CharacterData;
}

const catalogItems: Record<string, Item> = {
  "component-pouch": {
    id: "1",
    slug: "component-pouch",
    name: "Component Pouch",
    category: "focus",
    source: "SRD",
    rarity: "common",
    description: "",
    properties: {},
    requires_attunement: false,
    is_magic: false,
  },
  "holy-water": {
    id: "2",
    slug: "holy-water",
    name: "Holy Water (flask)",
    category: "adventuring_gear",
    source: "SRD",
    rarity: "common",
    cost_gp: 25,
    description: "",
    properties: {},
    requires_attunement: false,
    is_magic: false,
  },
  "diamonds-300-gp": {
    id: "3",
    slug: "diamonds-300-gp",
    name: "Diamonds (300 gp)",
    category: "trade_goods",
    source: "PHB",
    rarity: "common",
    cost_gp: 300,
    description: "",
    properties: {},
    requires_attunement: false,
    is_magic: false,
  },
};

describe("spell-material-requirements", () => {
  it("maps revivify to costly consumed diamonds", () => {
    const spec = getSpellMaterialSpec("revivify");
    assert.ok(spec);
    assert.equal(spec.choiceGroups[0]?.alternatives[0]?.itemSlug, "diamonds-300-gp");
    assert.equal(spec.choiceGroups[0]?.consumed, true);
    assert.equal(spec.focusWaivable, false);
  });
});

describe("spell-materials", () => {
  it("waives non-costly materials with component pouch", () => {
    const character = baseCharacter([
      {
        id: "inv-1",
        itemId: "component-pouch",
        name: "Component Pouch",
        quantity: 1,
        equipped: false,
      },
    ]);
    const eligibility = resolveSpellMaterialEligibility(
      character.inventory.items,
      "message",
      catalogItems,
      "V, S, M (A short piece of copper wire.)"
    );
    assert.equal(eligibility.canCast, true);
    assert.equal(eligibility.satisfiedByFocus, true);
  });

  it("requires costly revivify diamonds in inventory", () => {
    const without = baseCharacter([]);
    assert.equal(
      resolveSpellMaterialEligibility(
        without.inventory.items,
        "revivify",
        catalogItems,
        "V, S, M (Diamonds worth 300gp, which the spell consumes.)"
      ).canCast,
      false
    );

    const withDiamonds = baseCharacter([
      {
        id: "inv-diamond",
        itemId: "diamonds-300-gp",
        name: "Diamonds (300 gp)",
        quantity: 1,
        equipped: false,
      },
    ]);
    const eligibility = resolveSpellMaterialEligibility(
      withDiamonds.inventory.items,
      "revivify",
      catalogItems
    );
    assert.equal(eligibility.canCast, true);
    assert.equal(eligibility.satisfiedByFocus, false);
  });

  it("consumes inventory quantity at resolution", () => {
    const items: InventoryItem[] = [
      {
        id: "inv-diamond",
        itemId: "diamonds-300-gp",
        name: "Diamonds (300 gp)",
        quantity: 2,
        equipped: false,
      },
    ];
    const next = consumeSpellMaterials(items, [
      {
        groupIndex: 0,
        itemSlug: "diamonds-300-gp",
        inventoryItemId: "inv-diamond",
        itemName: "Diamonds (300 gp)",
        quantity: 1,
        consumed: true,
      },
    ]);
    assert.equal(next[0]?.quantity, 1);
  });

  it("builds a cast plan from player selections", () => {
    const character = baseCharacter([
      {
        id: "inv-holy",
        itemId: "holy-water",
        name: "Holy Water (flask)",
        quantity: 1,
        equipped: false,
      },
    ]);
    const { plan, error } = buildMaterialCastPlan(
      character.inventory.items,
      "protection-from-evil-and-good",
      catalogItems,
      [{ groupIndex: 0, inventoryItemId: "inv-holy" }]
    );
    assert.equal(error, undefined);
    assert.ok(plan);
    assert.equal(plan?.materialChoices[0]?.itemSlug, "holy-water");
    assert.equal(plan?.materialChoices[0]?.consumed, true);
  });

  it("detects spellcasting focus in inventory", () => {
    const character = baseCharacter([
      {
        id: "inv-focus",
        itemId: "component-pouch",
        name: "Component Pouch",
        quantity: 1,
        equipped: false,
      },
    ]);
    assert.equal(
      characterHasSpellcastingFocus(character.inventory.items, catalogItems),
      true
    );
  });
});
