import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveAllSpellGrants } from "./spell-grants";
import { ALL_SPECIES } from "@/lib/dnd/phb/species";
import { createDefaultCharacterData } from "@/lib/schemas/character";

function characterWithSpecies(speciesName: string) {
  return createDefaultCharacterData({
    basicInfo: { species: speciesName, xp: 0 },
  });
}

describe("resolveAllSpellGrants", () => {
  it("does not duplicate grants for species without a subspecies", () => {
    for (const speciesName of ["Githzerai", "Githyanki", "Triton"]) {
      const grants = resolveAllSpellGrants(characterWithSpecies(speciesName), {
        species: ALL_SPECIES,
      });
      const grantKeys = grants.map((g) => g.grantKey);
      assert.equal(
        grantKeys.length,
        new Set(grantKeys).size,
        `${speciesName} should not return duplicate grant keys`
      );
    }
  });

  it("includes subspecies-specific and parent species grants without duplicates", () => {
    const grants = resolveAllSpellGrants(
      createDefaultCharacterData({
        basicInfo: { species: "Elf (Drow)", xp: 0 },
      }),
      { species: ALL_SPECIES }
    );
    const grantKeys = grants.map((g) => g.grantKey);
    assert.equal(grantKeys.length, new Set(grantKeys).size);
    assert.ok(grantKeys.includes("grant:species:drow-magic"));
  });
});
