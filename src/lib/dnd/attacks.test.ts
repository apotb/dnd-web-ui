import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getAttackCategoryLabel,
  isMeleeWeaponAttack,
  type DerivedAttack,
} from "@/lib/dnd/attacks";

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
