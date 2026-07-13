import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatSpellPickerTooltip } from "./spell-display";

describe("formatSpellPickerTooltip", () => {
  it("lays out spell metadata on separate lines before the description", () => {
    const tooltip = formatSpellPickerTooltip({
      name: "Thorn Whip",
      school: "Transmutation",
      castingTime: "1 action",
      range: "30 feet",
      components: "V, S, M (the stem of a plant with thorns)",
      duration: "Instantaneous",
      description: "Make a ranged spell attack that deals piercing damage.",
    });

    assert.equal(
      tooltip,
      [
        "Thorn Whip",
        "Transmutation · V, S, M",
        "Cast time: 1 action",
        "Range: 30 feet",
        "Material: the stem of a plant with thorns",
        "Duration: Instantaneous",
        "",
        "Make a ranged spell attack that deals piercing damage.",
      ].join("\n")
    );
  });

  it("shortens verbose reaction casting times in metadata", () => {
    const tooltip = formatSpellPickerTooltip({
      name: "Shield",
      castingTime:
        "1 reaction, which you take when you are hit by an attack or targeted by the magic missile spell",
      range: "Self",
      description: "An invisible barrier of magical force appears and protects you.",
    });

    assert.ok(tooltip.includes("Cast time: 1 reaction"));
    assert.equal(
      tooltip.includes("which you take when you are hit"),
      false
    );
  });
});
