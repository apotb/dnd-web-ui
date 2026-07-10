import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canRemoveCategory,
  countItemsInCategory,
  ensureCategories,
  DEFAULT_NOTABLE_CATEGORIES,
  newCategory,
} from "./lore-category";

describe("lore-category", () => {
  it("injects default categories when missing", () => {
    const categories = ensureCategories({ notables: [] }, DEFAULT_NOTABLE_CATEGORIES);
    assert.equal(categories.length, 2);
    assert.equal(categories[0].label, "Merchant Princes");
    assert.equal(categories[1].label, "Port Nyanzaru");
  });

  it("keeps persisted categories when present", () => {
    const categories = ensureCategories(
      {
        categories: [{ id: "custom", label: "Custom", sortOrder: 0 }],
      },
      DEFAULT_NOTABLE_CATEGORIES
    );
    assert.equal(categories.length, 1);
    assert.equal(categories[0].id, "custom");
  });

  it("blocks category removal when items exist", () => {
    const items = [
      { category: "a" },
      { category: "b" },
      { category: "a" },
    ];
    assert.equal(countItemsInCategory(items, "a"), 2);
    assert.equal(canRemoveCategory(items, "a"), false);
    assert.equal(canRemoveCategory(items, "b"), false);
    assert.equal(canRemoveCategory(items, "c"), true);
  });

  it("creates a category with trimmed label", () => {
    const category = newCategory("Guilds", 3);
    assert.equal(category.label, "Guilds");
    assert.equal(category.sortOrder, 3);
    assert.ok(category.id);
  });
});
