import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeClassWithPhb } from "@/lib/content/catalog-merge";
import { PHB_CLASSES } from "@/lib/dnd/phb/classes";
import type { PhbClass } from "@/lib/dnd/phb/types";

describe("catalog-merge", () => {
  it("fills missing mechanics and slug from built-in PHB class data", () => {
    const paladin = PHB_CLASSES.find((entry) => entry.id === "paladin");
    assert.ok(paladin);

    const staleDbPaladin: PhbClass = {
      ...paladin!,
      features: paladin!.features.map((feature) => ({
        name: feature.name,
        description: feature.description,
      })),
    };

    const merged = mergeClassWithPhb(staleDbPaladin, paladin);
    const layOnHands = merged.features.find((feature) => feature.name === "Lay on Hands");
    assert.ok(layOnHands);
    assert.equal(layOnHands!.slug, "lay-on-hands");
    assert.equal(layOnHands!.mechanics?.kind, "hp-pool");
  });
});
