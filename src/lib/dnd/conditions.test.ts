import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PHB_CONDITIONS,
  applyConditionSlugs,
  getConditionBySlug,
  getConditionDisplayName,
  getConditionTooltip,
  normalizeCombatConditions,
  normalizeConditionSlug,
  removeConditionSlugs,
  slugifyConditionName,
} from "./conditions";

describe("slugifyConditionName", () => {
  it("lowercases and hyphenates", () => {
    assert.equal(slugifyConditionName("Deep Speech"), "deep-speech");
    assert.equal(slugifyConditionName("Prone"), "prone");
  });
});

describe("normalizeConditionSlug", () => {
  it("maps legacy display names to slugs", () => {
    assert.equal(normalizeConditionSlug("Prone"), "prone");
    assert.equal(normalizeConditionSlug("POISONED"), "poisoned");
  });

  it("preserves existing slugs", () => {
    assert.equal(normalizeConditionSlug("blinded"), "blinded");
  });

  it("preserves homebrew slug-shaped entries", () => {
    assert.equal(normalizeConditionSlug("cursed"), "cursed");
  });

  it("drops unknown free text", () => {
    assert.equal(normalizeConditionSlug("Badly hurt"), null);
  });
});

describe("normalizeCombatConditions", () => {
  it("deduplicates and normalizes mixed legacy input", () => {
    assert.deepEqual(
      normalizeCombatConditions([
        "Prone",
        "prone",
        "Poisoned",
        "cursed",
        "Badly hurt",
      ]),
      ["prone", "poisoned", "cursed"]
    );
  });
});

describe("catalog helpers", () => {
  const homebrew = [
    ...PHB_CONDITIONS,
    {
      slug: "cursed",
      name: "Cursed",
      description: "Custom curse.",
      isStandard: false,
      source: "Homebrew",
    },
  ];

  it("resolves by slug from extended catalog", () => {
    assert.equal(getConditionBySlug("cursed", homebrew)?.name, "Cursed");
    assert.equal(getConditionDisplayName("prone", homebrew), "Prone");
  });

  it("builds tooltip with name and description", () => {
    const tooltip = getConditionTooltip("prone", homebrew);
    assert.ok(tooltip?.includes("Prone"));
    assert.ok(tooltip?.includes("disadvantage on attack rolls"));
  });
});

describe("apply and remove condition slugs", () => {
  it("adds without duplicates", () => {
    assert.deepEqual(applyConditionSlugs(["prone"], ["poisoned", "prone"]), [
      "prone",
      "poisoned",
    ]);
  });

  it("removes listed slugs", () => {
    assert.deepEqual(removeConditionSlugs(["prone", "poisoned"], ["prone"]), [
      "poisoned",
    ]);
  });
});
