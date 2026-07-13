import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyDamageAtZeroHp,
  applyKnockToZeroHp,
  applyStabilize,
  applyWakeFromZeroHp,
  DYING_CONDITION_SLUG,
  ensureZeroHpDownedConditions,
  hasDyingCondition,
  needsDeathSavingThrow,
  syncCombatAfterHpChange,
  syncDownedConditionsAfterHpChange,
} from "./dying-state.ts";
import type { CharacterData } from "@/lib/schemas/character";

function baseCombat(
  overrides: Partial<CharacterData["combat"]> = {}
): CharacterData["combat"] {
  return {
    ac: 10,
    maxHp: 20,
    currentHp: 10,
    tempHp: 0,
    initiativeBonus: 0,
    speed: 30,
    hitDice: "1d10",
    levelUpHpGains: [],
    hpGainsDieOnly: true,
    hitDiceSpent: 0,
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    exhaustion: 0,
    concentration: { active: false, spell: "" },
    ...overrides,
  };
}

describe("dying-state", () => {
  it("applyKnockToZeroHp adds dying and auto conditions and resets saves", () => {
    const result = applyKnockToZeroHp(baseCombat({ currentHp: 5 }));
    assert.equal(result.currentHp, 0);
    assert.ok(result.conditions?.includes(DYING_CONDITION_SLUG));
    assert.ok(result.conditions?.includes("unconscious"));
    assert.ok(result.conditions?.includes("incapacitated"));
    assert.ok(result.conditions?.includes("prone"));
    assert.deepEqual(result.deathSaves, { successes: 0, failures: 0 });
  });

  it("needsDeathSavingThrow requires 0 HP and dying", () => {
    assert.equal(needsDeathSavingThrow(baseCombat({ currentHp: 0, conditions: [DYING_CONDITION_SLUG] })), true);
    assert.equal(needsDeathSavingThrow(baseCombat({ currentHp: 0, conditions: [] })), false);
    assert.equal(needsDeathSavingThrow(baseCombat({ currentHp: 1, conditions: [DYING_CONDITION_SLUG] })), false);
  });

  it("applyStabilize removes dying and resets saves", () => {
    const result = applyStabilize(
      baseCombat({
        currentHp: 0,
        conditions: [DYING_CONDITION_SLUG, "unconscious", "prone"],
        deathSaves: { successes: 2, failures: 1 },
      })
    );
    assert.equal(hasDyingCondition(result), false);
    assert.ok(result.conditions?.includes("unconscious"));
    assert.deepEqual(result.deathSaves, { successes: 0, failures: 0 });
  });

  it("applyWakeFromZeroHp removes unconscious and incapacitated but keeps prone", () => {
    const result = applyWakeFromZeroHp(
      baseCombat({
        currentHp: 0,
        conditions: [DYING_CONDITION_SLUG, "unconscious", "incapacitated", "prone", "poisoned"],
        deathSaves: { successes: 1, failures: 2 },
      }),
      5
    );
    assert.equal(result.currentHp, 5);
    assert.deepEqual(result.conditions, ["prone", "poisoned"]);
    assert.deepEqual(result.deathSaves, { successes: 0, failures: 0 });
  });

  it("applyDamageAtZeroHp adds failures and re-applies dying when stable", () => {
    const stable = baseCombat({
      currentHp: 0,
      conditions: ["unconscious", "prone"],
      deathSaves: { successes: 0, failures: 1 },
    });
    const result = applyDamageAtZeroHp(stable, { isCritical: true });
    assert.ok(hasDyingCondition(result));
    assert.equal(result.deathSaves.failures, 3);
  });

  it("syncCombatAfterHpChange knocks down on transition to 0", () => {
    const combat = baseCombat({ currentHp: 10 });
    const result = syncCombatAfterHpChange(combat, 0, { previousHp: 10, damageToHp: 10 });
    assert.ok(hasDyingCondition(result));
  });

  it("syncCombatAfterHpChange wakes on heal above 0 but keeps prone", () => {
    const combat = baseCombat({
      currentHp: 0,
      conditions: [DYING_CONDITION_SLUG, "unconscious", "incapacitated", "prone"],
      deathSaves: { successes: 0, failures: 2 },
    });
    const result = syncCombatAfterHpChange(combat, 3, { previousHp: 0 });
    assert.equal(result.currentHp, 3);
    assert.deepEqual(result.conditions, ["prone"]);
    assert.deepEqual(result.deathSaves, { successes: 0, failures: 0 });
  });

  it("syncCombatAfterHpChange applies damage failures at 0 HP", () => {
    const combat = baseCombat({
      currentHp: 0,
      conditions: [DYING_CONDITION_SLUG],
      deathSaves: { successes: 0, failures: 0 },
    });
    const result = syncCombatAfterHpChange(combat, 0, {
      previousHp: 0,
      damageToHp: 5,
      isCritical: false,
    });
    assert.equal(result.deathSaves.failures, 1);
  });

  it("ensureZeroHpDownedConditions adds downed slugs without dying", () => {
    const result = ensureZeroHpDownedConditions(["poisoned"]);
    assert.ok(result.includes("unconscious"));
    assert.ok(result.includes("incapacitated"));
    assert.ok(result.includes("prone"));
    assert.ok(result.includes("poisoned"));
    assert.equal(result.includes(DYING_CONDITION_SLUG), false);
  });

  it("syncDownedConditionsAfterHpChange knocks down and wakes", () => {
    const knocked = syncDownedConditionsAfterHpChange(10, 0, []);
    assert.ok(knocked.includes("unconscious"));
    assert.ok(knocked.includes("incapacitated"));
    assert.ok(knocked.includes("prone"));

    const woke = syncDownedConditionsAfterHpChange(0, 5, knocked);
    assert.deepEqual(woke, ["prone"]);
  });

  it("syncCombatAfterHpChange enforces downed conditions when already at 0 HP", () => {
    const combat = baseCombat({ currentHp: 0, conditions: [] });
    const result = syncCombatAfterHpChange(combat, 0, { previousHp: 0 });
    assert.ok(result.conditions?.includes("unconscious"));
    assert.ok(result.conditions?.includes("incapacitated"));
    assert.ok(result.conditions?.includes("prone"));
  });
});
