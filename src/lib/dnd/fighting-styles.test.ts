import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyGreatWeaponFightingRerolls,
  parseDamageNotation,
} from "@/lib/dnd/dice";
import {
  getArcheryAttackBonus,
  getDefenseAcBonus,
  getDuelingDamageBonus,
  hasTwoWeaponFighting,
  qualifiesForDueling,
  qualifiesForGreatWeaponFighting,
} from "@/lib/dnd/fighting-styles";
import type { DerivedAttack } from "@/lib/dnd/attacks";
import type { CharacterData } from "@/lib/schemas/character";
import type { Item } from "@/lib/schemas/item";

function baseCharacter(overrides: Partial<CharacterData> = {}): CharacterData {
  return {
    basicInfo: {
      name: "Test",
      species: "Human",
      background: "Soldier",
      class: "Fighter",
      classes: [],
      level: 5,
    },
    abilityScores: {
      str: 16,
      dex: 14,
      con: 14,
      int: 10,
      wis: 10,
      cha: 10,
    },
    combat: { ac: 16, currentHp: 30, tempHp: 0, speed: 30 },
    inventory: { items: [] },
    spells: {
      spellcastingAbility: null,
      slots: {},
      known: [],
      prepared: [],
    },
    features: [],
    featureChoices: { fightingStyle: "" },
    speciesChoices: {},
    backgroundChoices: {},
    ...overrides,
  } as CharacterData;
}

const longsword: Item = {
  id: "longsword",
  slug: "longsword",
  name: "Longsword",
  category: "weapon",
  properties: {
    weaponCategory: "martial",
    weaponRange: "melee",
    weaponProperties: ["versatile"],
    damage: "1d8",
    versatileDamage: "1d10",
    damageType: "slashing",
  },
};

const longbow: Item = {
  id: "longbow",
  slug: "longbow",
  name: "Longbow",
  category: "weapon",
  properties: {
    weaponCategory: "martial",
    weaponRange: "ranged",
    weaponProperties: ["two-handed", "ammunition"],
    damage: "1d8",
    damageType: "piercing",
    rangeNormal: 150,
    rangeLong: 600,
  },
};

const chainMail: Item = {
  id: "chain-mail",
  slug: "chain-mail",
  name: "Chain Mail",
  category: "armor",
  properties: {
    armorClass: 16,
    dexBonus: false,
    strengthRequirement: 13,
    stealthDisadvantage: true,
    armorType: "heavy",
  },
};

describe("fighting styles", () => {
  it("detects Two-Weapon Fighting from feature choices", () => {
    const character = baseCharacter({
      featureChoices: { fightingStyle: "Two-Weapon Fighting" },
    });
    assert.equal(hasTwoWeaponFighting(character), true);
  });

  it("grants Archery +2 on ranged weapon attacks only", () => {
    const character = baseCharacter({
      featureChoices: { fightingStyle: "Archery" },
    });
    assert.equal(getArcheryAttackBonus(character, true), 2);
    assert.equal(getArcheryAttackBonus(character, false), 0);
  });

  it("grants Defense +1 AC while wearing armor", () => {
    const character = baseCharacter({
      featureChoices: { fightingStyle: "Defense" },
      inventory: {
        items: [
          {
            id: "armor-1",
            itemId: "chain-mail",
            name: "Chain Mail",
            quantity: 1,
            equipped: true,
          },
        ],
      },
    });
    const bonus = getDefenseAcBonus(character, { "chain-mail": chainMail });
    assert.equal(bonus, 1);
  });

  it("grants Dueling +2 when wielding one one-handed melee weapon", () => {
    const character = baseCharacter({
      featureChoices: { fightingStyle: "Dueling" },
      inventory: {
        items: [
          {
            id: "sword-1",
            itemId: "longsword",
            name: "Longsword",
            quantity: 1,
            wieldMain: true,
          },
        ],
      },
    });
    assert.equal(
      getDuelingDamageBonus(
        character,
        { longsword },
        {
          isOffHand: false,
          isRanged: false,
          isThrown: false,
          catalogItem: longsword,
        }
      ),
      2
    );
    assert.equal(
      qualifiesForDueling(
        character,
        { longsword },
        {
          isOffHand: false,
          isRanged: false,
          isThrown: false,
          catalogItem: longsword,
        }
      ),
      true
    );
  });

  it("denies Dueling when an off-hand weapon is wielded", () => {
    const character = baseCharacter({
      featureChoices: { fightingStyle: "Dueling" },
      inventory: {
        items: [
          {
            id: "sword-1",
            itemId: "longsword",
            name: "Longsword",
            quantity: 1,
            wieldMain: true,
          },
          {
            id: "dagger-1",
            itemId: "dagger",
            name: "Dagger",
            quantity: 1,
            wieldOff: true,
          },
        ],
      },
    });
    const dagger: Item = {
      id: "dagger",
      slug: "dagger",
      name: "Dagger",
      category: "weapon",
      properties: {
        weaponCategory: "simple",
        weaponRange: "melee",
        weaponProperties: ["finesse", "light", "thrown"],
        damage: "1d4",
        damageType: "piercing",
        throwRangeNormal: 20,
        throwRangeLong: 60,
      },
    };
    assert.equal(
      qualifiesForDueling(
        character,
        { longsword, dagger },
        {
          isOffHand: false,
          isRanged: false,
          isThrown: false,
          catalogItem: longsword,
        }
      ),
      false
    );
  });

  it("qualifies Great Weapon Fighting for two-handed and versatile grips", () => {
    const character = baseCharacter({
      featureChoices: { fightingStyle: "Great Weapon Fighting" },
    });
    const meleeAttack: DerivedAttack = {
      id: "weapon-1",
      name: "Longsword",
      attackBonus: 5,
      damageDice: "1d10+3",
      damageType: "slashing",
      range: "5 ft",
      notes: "",
      source: "weapon",
      itemId: "longsword",
    };
    assert.equal(
      qualifiesForGreatWeaponFighting(
        character,
        { longsword, longbow },
        meleeAttack,
        "two-handed"
      ),
      true
    );
    assert.equal(
      qualifiesForGreatWeaponFighting(
        character,
        { longsword, longbow },
        { ...meleeAttack, itemId: "longbow" },
        "one-handed"
      ),
      false
    );
    assert.equal(
      qualifiesForGreatWeaponFighting(
        character,
        { longsword, longbow },
        meleeAttack,
        "one-handed"
      ),
      false
    );
  });

  it("rerolls Great Weapon Fighting dice at 1 or 2", () => {
    const rerolled = applyGreatWeaponFightingRerolls([1, 2, 4], [8, 8, 8]);
    assert.equal(rerolled.length, 3);
    assert.equal(rerolled[2], 4);
    assert.ok(rerolled[0] >= 1 && rerolled[0] <= 8);
    assert.ok(rerolled[1] >= 1 && rerolled[1] <= 8);
  });

  it("parses damage with modifier for GWF submit totals", () => {
    const parsed = parseDamageNotation("2d6+3");
    assert.ok(parsed);
    const total = parsed!.modifier + 3 + 4;
    assert.equal(total, 10);
  });
});
