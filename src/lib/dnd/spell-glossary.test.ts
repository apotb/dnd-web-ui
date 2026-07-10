import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatSpellMaterialLine,
  formatSpellDurationForDisplay,
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

describe("formatSpellDurationForDisplay", () => {
  it("strips Concentration prefix when the C badge is shown", () => {
    assert.equal(
      formatSpellDurationForDisplay("Concentration, up to 1 minute", {
        concentration: true,
      }),
      "up to 1 minute"
    );
  });

  it("keeps duration unchanged for non-concentration spells", () => {
    assert.equal(
      formatSpellDurationForDisplay("1 minute", { concentration: false }),
      "1 minute"
    );
  });
});
