import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyEnemyAction,
  enemyActionToDerivedAttack,
  isMultiattackAction,
  parseEnemyActions,
} from "@/lib/combat/enemy-action-parser";

describe("enemy-action-parser", () => {
  it("parses Bandit Scimitar as melee weapon attack", () => {
    const action = {
      name: "Scimitar",
      description:
        "Melee Weapon Attack: +3 to hit, reach 5 ft., one target. Hit: 4 (1d6 + 1) slashing damage.",
    };
    const parsed = classifyEnemyAction(action, 0);
    assert.equal(parsed.kind, "weapon-melee");
    assert.equal(parsed.attack?.attackBonus, 3);
    assert.equal(parsed.attack?.range, "5 ft");
    assert.equal(parsed.attack?.damageDice, "1d6 + 1");
    assert.equal(parsed.attack?.damageType, "slashing");
    assert.equal(parsed.attack?.source, "enemy");
  });

  it("parses Bandit Light Crossbow as ranged weapon attack", () => {
    const action = {
      name: "Light Crossbow",
      description:
        "Ranged Weapon Attack: +3 to hit, range 80/320 ft., one target. Hit: 5 (1d8 + 1) piercing damage.",
    };
    const parsed = classifyEnemyAction(action, 1);
    assert.equal(parsed.kind, "weapon-ranged");
    assert.equal(parsed.attack?.range, "80/320 ft");
    assert.equal(parsed.attack?.attackBonus, 3);
  });

  it("parses Thug Heavy Crossbow with long range", () => {
    const action = {
      name: "Heavy Crossbow",
      description:
        "Ranged Weapon Attack: +2 to hit, range 100/400 ft., one target. Hit: 5 (1d10) piercing damage.",
    };
    const parsed = classifyEnemyAction(action, 2);
    assert.equal(parsed.kind, "weapon-ranged");
    assert.equal(parsed.attack?.range, "100/400 ft");
    assert.equal(parsed.attack?.damageDice, "1d10");
  });

  it("parses reach 10 ft bite attacks", () => {
    const action = {
      name: "Bite",
      description:
        "Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 19 (2d10 + 8) piercing damage.",
    };
    const parsed = classifyEnemyAction(action, 0);
    assert.equal(parsed.attack?.range, "10 ft");
  });

  it("parses dual-mode Dagger as melee and ranged variants", () => {
    const action = {
      name: "Dagger",
      description:
        "Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 6 (1d6 + 3) slashing damage.",
    };
    const parsed = classifyEnemyAction(action, 0);
    assert.equal(parsed.kind, "weapon-dual");
    assert.equal(parsed.dualAttacks?.melee.range, "5 ft");
    assert.equal(parsed.dualAttacks?.ranged.range, "20/60 ft");
    assert.equal(enemyActionToDerivedAttack(action, 0, "ranged")?.name, "Dagger (ranged)");
  });

  it("parses Air Elemental Whirlwind as self-space save", () => {
    const action = {
      name: "Whirlwind",
      description:
        "Each creature in the elemental's space must make a DC 13 Strength saving throw. On a failure, a target takes 15 (3d8) bludgeoning damage and is pushed 10 feet away from the elemental.",
    };
    const parsed = classifyEnemyAction(action, 0);
    assert.equal(parsed.kind, "save");
    assert.equal(parsed.attack?.rollType, "save");
    assert.equal(parsed.attack?.saveDc, 13);
    assert.equal(parsed.attack?.saveAbility, "Str");
    assert.equal(parsed.attack?.range, "self-space");
    assert.equal(parsed.attack?.damageDice, "3d8");
  });

  it("parses dragon breath as cone save with half damage", () => {
    const action = {
      name: "Acid Breath",
      description:
        "The dragon exhales acid in a 60-foot cone. Each creature in that area must make a DC 18 Dexterity saving throw, taking 54 (12d8) acid damage on a failed save, or half as much damage on a successful one.",
    };
    const parsed = classifyEnemyAction(action, 0);
    assert.equal(parsed.kind, "save");
    assert.equal(parsed.attack?.range, "60-ft cone");
    assert.equal(parsed.attack?.saveDc, 18);
    assert.equal(parsed.attack?.saveAbility, "Dex");
    assert.equal(parsed.attack?.saveHalfDamageOnSuccess, true);
    assert.equal(parsed.attack?.damageType, "acid");
  });

  it("detects Multiattack action by name", () => {
    const action = {
      name: "Multiattack",
      description: "The thug makes two melee attacks.",
    };
    assert.equal(isMultiattackAction(action), true);
    assert.equal(classifyEnemyAction(action, 0).kind, "multiattack");
  });

  it("classifies unknown actions as other", () => {
    const action = {
      name: "Frightful Presence",
      description:
        "Each creature of the dragon's choice that is within 120 feet of the dragon and aware of it must succeed on a DC 21 Wisdom saving throw or become frightened for 1 minute.",
    };
    const parsed = classifyEnemyAction(action, 0);
    assert.equal(parsed.kind, "save");
    assert.equal(parsed.attack?.saveAbility, "Wis");
    assert.equal(parsed.attack?.range, "120 ft");
  });
});

describe("parseEnemyActions batch", () => {
  it("parses thug action list", () => {
    const actions = [
      { name: "Multiattack", description: "The thug makes two melee attacks." },
      {
        name: "Mace",
        description:
          "Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 5 (1d6 + 2) bludgeoning damage.",
      },
      {
        name: "Heavy Crossbow",
        description:
          "Ranged Weapon Attack: +2 to hit, range 100/400 ft., one target. Hit: 5 (1d10) piercing damage.",
      },
    ];
    const parsed = parseEnemyActions(actions);
    assert.equal(parsed[0].kind, "multiattack");
    assert.equal(parsed[1].kind, "weapon-melee");
    assert.equal(parsed[2].kind, "weapon-ranged");
  });
});
