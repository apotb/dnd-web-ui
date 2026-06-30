import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { syncFeatureGrants } from "@/lib/character/feature-grant-sync";
import {
  getGrantUsesForRest,
  restoreGrantSpell,
  resetGrantUses,
  syncGrantUses,
  useGrantSpell,
} from "@/lib/character/spell-grant-uses";
import { ALL_SPECIES } from "@/lib/dnd/phb/species";
import { createDefaultCharacterData } from "@/lib/schemas/character";

const catalogs = { species: ALL_SPECIES };

function tritonCharacter() {
  return createDefaultCharacterData({
    basicInfo: { species: "Triton", xp: 0 },
  });
}

function firbolgCharacter() {
  return createDefaultCharacterData({
    basicInfo: { species: "Firbolg", xp: 0 },
  });
}

describe("syncGrantUses", () => {
  it("initializes Triton fog cloud at 1/1", () => {
    const data = syncFeatureGrants(tritonCharacter(), catalogs);
    const uses = data.spells.grantUses["grant:species:triton-control-air-water"];
    assert.deepEqual(uses, { current: 1, max: 1 });
  });
});

describe("useGrantSpell", () => {
  it("decrements remaining uses and cannot go below 0", () => {
    const synced = syncFeatureGrants(tritonCharacter(), catalogs);
    const once = useGrantSpell(synced, "grant:species:triton-control-air-water");
    assert.equal(
      once.spells.grantUses["grant:species:triton-control-air-water"]?.current,
      0
    );

    const twice = useGrantSpell(once, "grant:species:triton-control-air-water");
    assert.equal(
      twice.spells.grantUses["grant:species:triton-control-air-water"]?.current,
      0
    );
  });
});

describe("resetGrantUses", () => {
  it("restores long-rest grants on long rest only", () => {
    const synced = syncFeatureGrants(tritonCharacter(), catalogs);
    const spent = useGrantSpell(synced, "grant:species:triton-control-air-water");

    const afterShort = resetGrantUses(spent.spells, "short", spent, catalogs);
    assert.equal(
      afterShort.grantUses["grant:species:triton-control-air-water"]?.current,
      0
    );

    const afterLong = resetGrantUses(spent.spells, "long", spent, catalogs);
    assert.equal(
      afterLong.grantUses["grant:species:triton-control-air-water"]?.current,
      1
    );
  });

  it("restores short-rest grants on short rest and long rest", () => {
    const synced = syncFeatureGrants(firbolgCharacter(), catalogs);
    const key = "grant:species:firbolg-magic:detect-magic";
    const spent = useGrantSpell(synced, key);

    const afterShort = resetGrantUses(spent.spells, "short", spent, catalogs);
    assert.equal(afterShort.grantUses[key]?.current, 1);

    const spentAgain = useGrantSpell(synced, key);
    const afterLong = resetGrantUses(spentAgain.spells, "long", spentAgain, catalogs);
    assert.equal(afterLong.grantUses[key]?.current, 1);
  });
});

describe("restoreGrantSpell", () => {
  it("increments remaining uses up to max", () => {
    const synced = syncFeatureGrants(tritonCharacter(), catalogs);
    const spent = useGrantSpell(synced, "grant:species:triton-control-air-water");
    const restored = restoreGrantSpell(
      spent,
      "grant:species:triton-control-air-water"
    );
    assert.equal(
      restored.spells.grantUses["grant:species:triton-control-air-water"]?.current,
      1
    );
  });
});

describe("getGrantUsesForRest", () => {
  it("lists only depleted grants matching the rest type", () => {
    const synced = syncFeatureGrants(tritonCharacter(), catalogs);
    const spent = useGrantSpell(synced, "grant:species:triton-control-air-water");

    assert.equal(getGrantUsesForRest(spent, "short", catalogs).length, 0);
    const longItems = getGrantUsesForRest(spent, "long", catalogs);
    assert.equal(longItems.length, 1);
    assert.match(longItems[0], /Fog Cloud/);
    assert.match(longItems[0], /\(0\/1\)/);
  });
});
