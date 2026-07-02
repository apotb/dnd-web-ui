import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applySoulmongerRolls,
  createDefaultSoulmongerData,
  interpretSoulmongerRoll,
  newSoulmongerSoul,
} from "./soulmonger";

const endingDate = { year: 1490, month: 6, day: 15 };

describe("interpretSoulmongerRoll", () => {
  it("treats 1 as devoured", () => {
    assert.equal(interpretSoulmongerRoll(1), "devoured");
  });

  it("treats 2–20 as survived", () => {
    assert.equal(interpretSoulmongerRoll(2), "survived");
    assert.equal(interpretSoulmongerRoll(20), "survived");
  });
});

describe("applySoulmongerRolls", () => {
  it("moves a soul to devoured on a roll of 1", () => {
    const soul = newSoulmongerSoul("Acererak");
    const data = createDefaultSoulmongerData({ active: [soul] });

    const next = applySoulmongerRolls(data, { [soul.id]: 1 }, endingDate);

    assert.equal(next.active.length, 0);
    assert.equal(next.devoured.length, 1);
    assert.equal(next.devoured[0]?.name, "Acererak");
    assert.deepEqual(next.devoured[0]?.devouredOn, endingDate);
  });

  it("keeps a soul active on rolls 2–20", () => {
    const soul = newSoulmongerSoul("Wandering soul");
    const data = createDefaultSoulmongerData({ active: [soul] });

    for (const roll of [2, 10, 20]) {
      const next = applySoulmongerRolls(data, { [soul.id]: roll }, endingDate);
      assert.equal(next.active.length, 1);
      assert.equal(next.active[0]?.id, soul.id);
      assert.equal(next.devoured.length, 0);
    }
  });

  it("handles multiple souls in one batch", () => {
    const survivor = newSoulmongerSoul("Survivor");
    const devoured = newSoulmongerSoul("Devoured");
    const data = createDefaultSoulmongerData({
      active: [survivor, devoured],
    });

    const next = applySoulmongerRolls(
      data,
      { [survivor.id]: 12, [devoured.id]: 1 },
      endingDate
    );

    assert.equal(next.active.length, 1);
    assert.equal(next.active[0]?.name, "Survivor");
    assert.equal(next.devoured.length, 1);
    assert.equal(next.devoured[0]?.name, "Devoured");
  });

  it("leaves souls without rolls in active", () => {
    const rolled = newSoulmongerSoul("Rolled");
    const skipped = newSoulmongerSoul("Skipped");
    const data = createDefaultSoulmongerData({ active: [rolled, skipped] });

    const next = applySoulmongerRolls(data, { [rolled.id]: 5 }, endingDate);

    assert.equal(next.active.length, 2);
    assert.deepEqual(
      next.active.map((soul) => soul.name).sort(),
      ["Rolled", "Skipped"]
    );
    assert.equal(next.devoured.length, 0);
  });
});
