import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canSelectTwoHandedWeaponGrip,
  getAttackCategoryLabel,
  isMeleeWeaponAttack,
  type DerivedAttack,
} from "@/lib/dnd/attacks";
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

const shield: Item = {
  id: "shield",
  slug: "shield",
  name: "Shield",
  category: "shield",
  properties: {
    armorClass: 2,
  },
};

function weaponAttack(overrides: Partial<DerivedAttack> = {}): DerivedAttack {
  return {
    id: "weapon-longsword",
    name: "Longsword",
    attackBonus: 7,
    damageDice: "1d8",
    damageType: "slashing",
    range: "5 ft",
    notes: "",
    source: "weapon",
    rollType: "attack",
    ...overrides,
  };
}

describe("isMeleeWeaponAttack", () => {
  it("returns true for standard melee weapons", () => {
    assert.equal(isMeleeWeaponAttack(weaponAttack()), true);
  });

  it("returns true for reach melee weapons", () => {
    assert.equal(
      isMeleeWeaponAttack(weaponAttack({ name: "Glaive", range: "10 ft" })),
      true
    );
  });

  it("returns false for ranged weapons with normal/long range bands", () => {
    assert.equal(
      isMeleeWeaponAttack(
        weaponAttack({ id: "weapon-longbow", name: "Longbow", range: "150/600 ft" })
      ),
      false
    );
  });

  it("returns false for thrown weapon attacks", () => {
    assert.equal(
      isMeleeWeaponAttack(
        weaponAttack({
          id: "weapon-javelin-thrown",
          throwsWeapon: true,
          range: "30/120 ft",
        })
      ),
      false
    );
  });

  it("returns false for non-weapon attacks", () => {
    assert.equal(
      isMeleeWeaponAttack(weaponAttack({ source: "cantrip", range: "120 feet" })),
      false
    );
  });
});

describe("getAttackCategoryLabel", () => {
  it("labels standard melee weapons as Melee", () => {
    assert.equal(getAttackCategoryLabel(weaponAttack()), "Melee");
  });

  it("labels reach melee weapons as Melee", () => {
    assert.equal(
      getAttackCategoryLabel(weaponAttack({ name: "Glaive", range: "10 ft" })),
      "Melee"
    );
  });

  it("labels ranged weapons as Ranged", () => {
    assert.equal(
      getAttackCategoryLabel(
        weaponAttack({ id: "weapon-longbow", name: "Longbow", range: "150/600 ft" })
      ),
      "Ranged"
    );
  });

  it("labels thrown weapon attacks as Thrown", () => {
    assert.equal(
      getAttackCategoryLabel(
        weaponAttack({
          id: "weapon-javelin-thrown",
          throwsWeapon: true,
          range: "30/120 ft",
        })
      ),
      "Thrown"
    );
  });

  it("labels cantrips as Cantrip", () => {
    assert.equal(
      getAttackCategoryLabel(
        weaponAttack({ source: "cantrip", range: "120 feet" })
      ),
      "Cantrip"
    );
  });
});

describe("canSelectTwoHandedWeaponGrip", () => {
  it("allows two-handed grip with a free off hand", () => {
    const character = baseCharacter({
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
      canSelectTwoHandedWeaponGrip(character, { longsword }),
      true
    );
  });

  it("denies two-handed grip when a shield is equipped", () => {
    const character = baseCharacter({
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
            id: "shield-1",
            itemId: "shield",
            name: "Shield",
            quantity: 1,
            equipped: true,
          },
        ],
      },
    });
    assert.equal(
      canSelectTwoHandedWeaponGrip(character, { longsword, shield }),
      false
    );
  });

  it("denies two-handed grip when an off-hand weapon is wielded", () => {
    const character = baseCharacter({
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
    assert.equal(
      canSelectTwoHandedWeaponGrip(character, { longsword, dagger }),
      false
    );
  });

  it("allows two-handed grip when character data is missing", () => {
    assert.equal(canSelectTwoHandedWeaponGrip(undefined, {}), true);
  });
});
