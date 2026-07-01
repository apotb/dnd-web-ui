import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatSpellMaterialLine,
  getSpellMaterialNotice,
} from "./spell-glossary";

describe("getSpellMaterialNotice", () => {
  it("parses material text and consumed flag", () => {
    assert.deepEqual(
      getSpellMaterialNotice("V, S, M (holy water or powdered silver and iron, consumed by the spell)"),
      {
        description: "holy water or powdered silver and iron",
        consumed: true,
      }
    );
  });

  it("returns null when no material component", () => {
    assert.equal(getSpellMaterialNotice("V, S"), null);
  });
});

describe("formatSpellMaterialLine", () => {
  it("formats a readable material line", () => {
    assert.equal(
      formatSpellMaterialLine("V, S, M (a drop of blood)"),
      "Material: a drop of blood"
    );
  });
});
