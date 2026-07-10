import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseEnemyActions } from "@/lib/combat/enemy-action-parser";
import {
  buildInitialMultiattackRemaining,
  getMultiattackSpec,
  parseMultiattackDescription,
  totalMultiattackRemaining,
  decrementMultiattackRemaining,
} from "@/lib/combat/multiattack";

describe("multiattack parser", () => {
  it("parses thug two melee attacks", () => {
    const parsedActions = parseEnemyActions([
      { name: "Multiattack", description: "The thug makes two melee attacks." },
      {
        name: "Mace",
        description:
          "Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 5 (1d6 + 2) bludgeoning damage.",
      },
    ]);
    const spec = parseMultiattackDescription(
      "The thug makes two melee attacks.",
      parsedActions
    );
    assert.equal(spec.branches.length, 1);
    assert.equal(spec.branches[0].categoryFilter, "melee");
    const remaining = buildInitialMultiattackRemaining(spec.branches[0], parsedActions);
    assert.equal(remaining.mace, 2);
  });

  it("parses dragon bite and claw counts", () => {
    const parsedActions = parseEnemyActions([
      {
        name: "Multiattack",
        description:
          "The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.",
      },
      {
        name: "Bite",
        description:
          "Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 19 (2d10 + 8) piercing damage.",
      },
      {
        name: "Claw",
        description:
          "Melee Weapon Attack: +14 to hit, reach 5 ft., one target. Hit: 15 (2d6 + 8) slashing damage.",
      },
    ]);
    const spec = getMultiattackSpec([
      {
        name: "Multiattack",
        description:
          "The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.",
      },
      parsedActions[1].action,
      parsedActions[2].action,
    ]);
    assert.ok(spec?.preamble?.includes("Frightful Presence"));
    assert.equal(spec?.branches[0].weaponLimits.bite, 1);
    assert.equal(spec?.branches[0].weaponLimits.claw, 2);
  });

  it("parses Bandit Captain alternative branches", () => {
    const parsedActions = parseEnemyActions([
      {
        name: "Multiattack",
        description:
          "The captain makes three melee attacks: two with its scimitar and one with its dagger. Or the captain makes two ranged attacks with its daggers.",
      },
      {
        name: "Scimitar",
        description:
          "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) slashing damage.",
      },
      {
        name: "Dagger",
        description:
          "Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 6 (1d6 + 3) slashing damage.",
      },
    ]);
    const spec = parseMultiattackDescription(
      parsedActions[0].action.description,
      parsedActions
    );
    assert.equal(spec.branches.length, 2);
    assert.equal(spec.branches[0].weaponLimits.scimitar, 2);
    assert.equal(spec.branches[0].weaponLimits.dagger, 1);
    assert.equal(spec.branches[1].weaponLimits.dagger, 2);
  });

  it("decrements remaining attack counts", () => {
    let remaining = { mace: 2 };
    remaining = decrementMultiattackRemaining(remaining, "Mace");
    assert.equal(remaining.mace, 1);
    remaining = decrementMultiattackRemaining(remaining, "Mace");
    assert.equal(remaining.mace, undefined);
    assert.equal(totalMultiattackRemaining(remaining), 0);
  });
});
