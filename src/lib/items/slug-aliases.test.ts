import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mapItemsBySlugWithAliases,
  resolveCanonicalItemSlug,
} from "./slug-aliases";
import type { Item } from "@/lib/schemas/item";

function stubItem(slug: string): Item {
  return {
    id: slug,
    slug,
    name: slug,
    category: "focus",
    source: "SRD",
    rarity: "common",
    description: "",
    properties: {},
    requires_attunement: false,
    is_magic: false,
  };
}

describe("resolveCanonicalItemSlug", () => {
  it("maps removed focus duplicates to canonical slugs", () => {
    assert.equal(resolveCanonicalItemSlug("sprig-of-mistletoe"), "druidic-focus");
    assert.equal(resolveCanonicalItemSlug("holy-water-flask"), "holy-water");
    assert.equal(resolveCanonicalItemSlug("quarterstaff"), "quarterstaff");
  });
});

describe("mapItemsBySlugWithAliases", () => {
  it("exposes legacy slugs on the fetched canonical item", () => {
    const fetched = { "druidic-focus": stubItem("druidic-focus") };
    const map = mapItemsBySlugWithAliases(["sprig-of-mistletoe"], fetched);
    assert.equal(map["sprig-of-mistletoe"]?.slug, "druidic-focus");
  });
});
