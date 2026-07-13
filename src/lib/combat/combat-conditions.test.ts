import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  conditionsEqual,
  EXHAUSTION_CONDITION_SLUG,
  finalizeDmConditionEdit,
  getConditionsForToken,
  getDmProtectedConditionSlugs,
  getProtectedConditionNote,
  resolveManagedConditions,
  syncExhaustionCondition,
  syncTokenConditionsAfterHpChange,
} from "@/lib/combat/combat-conditions";
import type { CombatToken } from "@/lib/schemas/combat-state";

function makeToken(overrides: Partial<CombatToken> = {}): CombatToken {
  return {
    id: "token-1",
    kind: "enemy",
    name: "Goblin",
    label: "G",
    tooltip: "",
    portraitPath: null,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    placed: true,
    damageTaken: 0,
    hasCollision: false,
    isObject: false,
    itemPickup: false,
    pickupQuantity: 1,
    hidden: false,
    conditions: [],
    activeEffects: [],
    ...overrides,
  };
}

describe("getConditionsForToken", () => {
  it("reads enemy token conditions", () => {
    const token = makeToken({ conditions: ["poisoned", "prone"] });
    assert.deepEqual(getConditionsForToken(token), ["poisoned", "prone"]);
  });

  it("reads party character combat conditions", () => {
    const token = makeToken({ kind: "party", characterId: "char-1" });
    const character = {
      id: "char-1",
      data: { combat: { conditions: ["frightened"] } },
    } as Parameters<typeof getConditionsForToken>[1];
    assert.deepEqual(getConditionsForToken(token, character), ["frightened"]);
  });

  it("reads ally roster conditions", () => {
    const token = makeToken({ kind: "ally", allyId: "ally-1" });
    const ally = { id: "ally-1", conditions: ["grappled"] } as Parameters<
      typeof getConditionsForToken
    >[2];
    assert.deepEqual(getConditionsForToken(token, null, ally), ["grappled"]);
  });
});

describe("getDmProtectedConditionSlugs", () => {
  it("returns nothing above 0 HP", () => {
    assert.deepEqual(getDmProtectedConditionSlugs(5, ["dying", "prone"]), []);
  });

  it("protects downed slugs at 0 HP", () => {
    assert.deepEqual(
      getDmProtectedConditionSlugs(0, ["dying", "poisoned"]),
      ["incapacitated", "unconscious", "prone", "dying"]
    );
  });

  it("does not protect dying when not present at 0 HP", () => {
    assert.deepEqual(
      getDmProtectedConditionSlugs(0, ["unconscious", "prone", "incapacitated"]),
      ["incapacitated", "unconscious", "prone"]
    );
  });

  it("protects exhaustion when exhaustion level is greater than 0", () => {
    assert.deepEqual(
      getDmProtectedConditionSlugs(10, ["poisoned"], 2),
      [EXHAUSTION_CONDITION_SLUG]
    );
  });
});

describe("syncExhaustionCondition", () => {
  it("adds exhaustion slug when level is greater than 0", () => {
    assert.deepEqual(syncExhaustionCondition(["poisoned"], 1), [
      "poisoned",
      EXHAUSTION_CONDITION_SLUG,
    ]);
  });

  it("removes exhaustion slug when level returns to 0", () => {
    assert.deepEqual(
      syncExhaustionCondition(["poisoned", EXHAUSTION_CONDITION_SLUG], 0),
      ["poisoned"]
    );
  });
});

describe("resolveManagedConditions", () => {
  it("applies both downed and exhaustion conditions", () => {
    const result = resolveManagedConditions(["poisoned"], 0, 2);
    assert.ok(result.includes("poisoned"));
    assert.ok(result.includes(EXHAUSTION_CONDITION_SLUG));
    assert.ok(result.includes("unconscious"));
  });
});

describe("getProtectedConditionNote", () => {
  it("describes exhaustion protection", () => {
    assert.equal(
      getProtectedConditionNote(EXHAUSTION_CONDITION_SLUG),
      "Synced from exhaustion levels"
    );
  });
});

describe("finalizeDmConditionEdit", () => {
  it("re-merges protected slugs removed from the draft", () => {
    const current = ["dying", "unconscious", "incapacitated", "prone", "poisoned"];
    const proposed = ["poisoned", "frightened"];
    const result = finalizeDmConditionEdit(proposed, 0, current);
    assert.ok(result.includes("poisoned"));
    assert.ok(result.includes("frightened"));
    assert.ok(result.includes("dying"));
    assert.ok(result.includes("unconscious"));
    assert.ok(result.includes("incapacitated"));
    assert.ok(result.includes("prone"));
  });

  it("allows full edit above 0 HP", () => {
    const current = ["poisoned", "prone"];
    const proposed = ["frightened"];
    assert.deepEqual(finalizeDmConditionEdit(proposed, 3, current), ["frightened"]);
  });

  it("re-merges exhaustion when levels are greater than 0", () => {
    const current = ["poisoned", EXHAUSTION_CONDITION_SLUG];
    const proposed = ["poisoned"];
    const result = finalizeDmConditionEdit(proposed, 10, current, 2);
    assert.ok(result.includes("poisoned"));
    assert.ok(result.includes(EXHAUSTION_CONDITION_SLUG));
  });
});

describe("syncTokenConditionsAfterHpChange", () => {
  it("adds downed conditions when dropping to 0 HP", () => {
    const result = syncTokenConditionsAfterHpChange(5, 0, []);
    assert.ok(result.includes("unconscious"));
    assert.ok(result.includes("incapacitated"));
    assert.ok(result.includes("prone"));
  });

  it("removes unconscious and incapacitated when healing above 0 HP but keeps prone", () => {
    const result = syncTokenConditionsAfterHpChange(0, 3, [
      "unconscious",
      "incapacitated",
      "prone",
      "poisoned",
    ]);
    assert.deepEqual(result, ["prone", "poisoned"]);
  });
});

describe("conditionsEqual", () => {
  it("compares normalized slug lists", () => {
    assert.equal(conditionsEqual(["prone", "poisoned"], ["poisoned", "prone"]), true);
    assert.equal(conditionsEqual(["prone"], ["poisoned"]), false);
  });
});
