import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { syncFeatureGrants } from "@/lib/character/feature-grant-sync";
import { resolveAllSpellGrants } from "@/lib/character/spell-grants";
import { enforcePreparedLimit } from "@/lib/dnd/spellcasting";
import { PHB_CLASSES } from "@/lib/dnd/phb/classes";
import { createDefaultCharacterData } from "@/lib/schemas/character";
import type { Spell } from "@/lib/schemas/character";

const catalogs = { classes: PHB_CLASSES };

function lifeCleric(xp = 0) {
  return createDefaultCharacterData({
    basicInfo: {
      class: "Cleric",
      classes: ["Cleric"],
      subclass: "Life Domain",
      xp,
    },
  });
}

describe("Cleric domain spells", () => {
  it("grants Life domain 1st-level spells at level 1", () => {
    const grants = resolveAllSpellGrants(lifeCleric(), catalogs);
    const bless = grants.find((g) => g.spellId === "bless");
    const cure = grants.find((g) => g.spellId === "cure-wounds");
    assert.ok(bless);
    assert.ok(cure);
    assert.equal(bless?.grantKey, "grant:subclass:domain-spell:life:bless");
    assert.equal(bless?.minCharacterLevel, 1);
    assert.equal(bless?.sourceLabel, "Life Domain");
  });

  it("syncs domain spells as always-prepared grant entries", () => {
    const synced = syncFeatureGrants(lifeCleric(), catalogs);
    const domainSpells = synced.spells.known.filter((s) =>
      s.grantKey?.startsWith("grant:subclass:domain-spell:life:")
    );
    assert.equal(domainSpells.length, 2);
    assert.ok(domainSpells.every((s) => s.prepared));
    assert.ok(domainSpells.some((s) => s.spellId === "bless"));
    assert.ok(domainSpells.some((s) => s.spellId === "cure-wounds"));
  });

  it("does not count domain spells against player prepare limit", () => {
    const playerSpells: Spell[] = [
      { id: "1", spellId: "guiding-bolt", name: "Guiding Bolt", level: 1, prepared: true },
      { id: "2", spellId: "healing-word", name: "Healing Word", level: 1, prepared: true },
      { id: "3", spellId: "sanctuary", name: "Sanctuary", level: 1, prepared: true },
      { id: "4", spellId: "shield-of-faith", name: "Shield of Faith", level: 1, prepared: true },
    ];
    const synced = syncFeatureGrants(
      {
        ...lifeCleric(),
        spells: {
          ...lifeCleric().spells,
          known: playerSpells,
        },
      },
      catalogs
    );
    const trimmed = enforcePreparedLimit(synced.spells.known, 4);
    const playerPrepared = trimmed.filter(
      (s) => s.level > 0 && s.prepared && !s.grantKey?.startsWith("grant:")
    );
    const grantPrepared = trimmed.filter(
      (s) => s.level > 0 && s.prepared && s.grantKey?.startsWith("grant:")
    );
    assert.equal(playerPrepared.length, 4);
    assert.equal(grantPrepared.length, 2);
  });
});

describe("Cleric domain proficiencies", () => {
  it("grants heavy armor for Life domain", () => {
    const synced = syncFeatureGrants(lifeCleric(), catalogs);
    assert.ok(synced.armorProficiencies.includes("heavy armor"));
  });

  it("grants heavy armor and martial weapons for Tempest domain", () => {
    const data = createDefaultCharacterData({
      basicInfo: {
        class: "Cleric",
        classes: ["Cleric"],
        subclass: "Tempest Domain",
      },
    });
    const synced = syncFeatureGrants(data, catalogs);
    assert.ok(synced.armorProficiencies.includes("heavy armor"));
    assert.ok(synced.weaponProficiencies.includes("martial weapons"));
  });

  it("does not grant extra proficiencies for Knowledge domain", () => {
    const data = createDefaultCharacterData({
      basicInfo: {
        class: "Cleric",
        classes: ["Cleric"],
        subclass: "Knowledge Domain",
      },
    });
    const synced = syncFeatureGrants(data, catalogs);
    assert.ok(!synced.armorProficiencies.includes("heavy armor"));
    assert.ok(!synced.weaponProficiencies.includes("martial weapons"));
  });
});
