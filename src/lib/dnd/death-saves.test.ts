import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyDeathSaveRoll } from "./death-saves.ts";
import { DYING_CONDITION_SLUG, hasDyingCondition } from "./dying-state.ts";
import type { CharacterData } from "@/lib/schemas/character";

function dyingCombat(): CharacterData["combat"] {
  return {
    ac: 10,
    maxHp: 20,
    currentHp: 0,
    tempHp: 0,
    initiativeBonus: 0,
    speed: 30,
    hitDice: "1d10",
    levelUpHpGains: [],
    hpGainsDieOnly: true,
    hitDiceSpent: 0,
    deathSaves: { successes: 0, failures: 0 },
    conditions: [DYING_CONDITION_SLUG, "unconscious", "incapacitated", "prone"],
    exhaustion: 0,
    concentration: { active: false, spell: "" },
  };
}

describe("death-saves", () => {
  it("natural 20 wakes and removes auto downed conditions", () => {
    const result = applyDeathSaveRoll(dyingCombat(), 20);
    assert.equal(result.combat.currentHp, 1);
    assert.equal(result.regainedConsciousness, true);
    assert.equal(hasDyingCondition(result.combat), false);
    assert.deepEqual(result.combat.conditions, []);
  });

  it("3 successes stabilizes and removes dying", () => {
    const combat = {
      ...dyingCombat(),
      deathSaves: { successes: 2, failures: 0 },
    };
    const result = applyDeathSaveRoll(combat, 15);
    assert.equal(result.becameStable, true);
    assert.equal(hasDyingCondition(result.combat), false);
    assert.deepEqual(result.combat.deathSaves, { successes: 0, failures: 0 });
    assert.ok(result.combat.conditions?.includes("unconscious"));
  });

  it("3 failures marks dead without removing dying", () => {
    const combat = {
      ...dyingCombat(),
      deathSaves: { successes: 0, failures: 2 },
    };
    const result = applyDeathSaveRoll(combat, 5);
    assert.equal(result.becameDead, true);
    assert.equal(result.combat.deathSaves.failures, 3);
  });
});
