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
});
