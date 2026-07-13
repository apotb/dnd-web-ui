import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveWeaponAttacks } from "@/lib/dnd/attacks";
import type { CharacterData } from "@/lib/schemas/character";
import { getWeaponProperties, type Item } from "@/lib/schemas/item";

/** Shape from supabase/migrations/080_seed_srd_items.sql (battleaxe row). */
const battleaxe: Item = {
  id: "battleaxe",
  slug: "battleaxe",
  name: "Battleaxe",
  category: "weapon",
  properties: {
    damage: "1d8",
    damageType: "slashing",
    versatileDamage: "1d10",
    weaponCategory: "martial",
    weaponRange: "melee",
    weaponProperties: ["versatile"],
    rangeNormal: 5,
    rangeLong: null,
    throwRangeNormal: null,
    throwRangeLong: null,
  },
};

function baseCharacter(overrides: Partial<CharacterData> = {}): CharacterData {
  return {
    basicInfo: {
      name: "Test",
      species: "Human",
      background: "Soldier",
      class: "Fighter",
      subclass: "",
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

describe("getWeaponProperties", () => {
  it("parses DB-seeded weapon properties with null optional range fields", () => {
    const props = getWeaponProperties(battleaxe);
    assert.ok(props);
    assert.equal(props.damage, "1d8");
    assert.equal(props.damageType, "slashing");
    assert.equal(props.weaponRange, "melee");
    assert.equal(props.rangeNormal, 5);
    assert.equal(props.rangeLong, null);
    assert.equal(props.throwRangeNormal, null);
    assert.equal(props.throwRangeLong, null);
  });
});

describe("deriveWeaponAttacks", () => {
  it("derives attacks from wielded weapons with DB-shaped properties", () => {
    const character = baseCharacter({
      inventory: {
        items: [
          {
            id: "axe-1",
            itemId: "battleaxe",
            name: "Battleaxe",
            quantity: 1,
            wieldMain: true,
          },
        ],
      },
    });

    const attacks = deriveWeaponAttacks(character, { battleaxe }, []);
    assert.equal(attacks.length, 1);
    assert.equal(attacks[0]?.name, "Battleaxe");
    assert.equal(attacks[0]?.source, "weapon");
    assert.equal(attacks[0]?.damageDice, "1d8+3");
  });
});
