import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveGrantedFeatures } from "@/lib/character/feature-derivation";
import { PHB_CLASSES } from "@/lib/dnd/phb/classes";
import { createDefaultCharacterData } from "@/lib/schemas/character";

const catalogs = { classes: PHB_CLASSES };

function wizard(xp: number) {
  return createDefaultCharacterData({
    basicInfo: {
      class: "Wizard",
      classes: ["Wizard"],
      subclass: "",
      xp,
    },
  });
}

describe("deriveGrantedFeatures level gates", () => {
  it("omits Arcane Recovery for level 1 wizards", () => {
    const features = deriveGrantedFeatures(wizard(0), catalogs);
    assert.equal(
      features.some((feature) => feature.name === "Arcane Recovery"),
      false
    );
  });

  it("includes Arcane Recovery for level 2 wizards", () => {
    const features = deriveGrantedFeatures(wizard(300), catalogs);
    const arcaneRecovery = features.find(
      (feature) => feature.name === "Arcane Recovery"
    );
    assert.ok(arcaneRecovery);
    assert.equal(arcaneRecovery!.source, "class");
  });
});
