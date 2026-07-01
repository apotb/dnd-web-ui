import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getCantripsForList, getSpell } from "./spells";

describe("PHB spell class lists", () => {
  it("includes Thorn Whip on the druid cantrip list", () => {
    const cantripIds = getCantripsForList("druid").map((spell) => spell.id);
    assert.ok(cantripIds.includes("thorn-whip"), "thorn-whip should be a druid cantrip");
  });

  it("assigns class lists to PHB-only spells missing from SRD", () => {
    const thornWhip = getSpell("thorn-whip");
    assert.ok(thornWhip);
    assert.deepEqual(thornWhip?.classes, ["druid"]);
  });
});
