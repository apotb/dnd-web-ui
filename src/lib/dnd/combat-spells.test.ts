import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CharacterData, Spell } from "@/lib/schemas/character";
import {
  formatDeclareCastSpellSubtitle,
  formatSpellCombatSubtitle,
  getEligibleCastSlotLevels,
  getSpellCastingCost,
  listCombatCastableCantripSpells,
  listCombatCastableActionSpellsForPicker,
  listCombatCastableLeveledSpells,
  listCombatCastableSpells,
} from "./combat-spells";
import { deriveSpellAttacks } from "./attacks";

function spell(overrides: Partial<Spell> & Pick<Spell, "name" | "level">): Spell {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name,
    level: overrides.level,
    prepared: overrides.prepared ?? false,
    notes: overrides.notes ?? "",
    spellId: overrides.spellId,
    grantKey: overrides.grantKey,
  };
}

function baseCharacter(spells: Spell[]): CharacterData {
  return {
    basicInfo: {
      name: "Test",
      playerName: "",
      level: 5,
      xp: 6500,
      classes: ["Cleric"],
      subclass: "",
      species: "",
      background: "",
      alignment: "",
      portrait: "",
      publicNotes: "",
      dmNotes: "",
    },
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
    spells: {
      spellcastingAbility: "wis",
      spellcastingHidden: false,
      slots: { "1": { max: 4, used: 0 }, "2": { max: 3, used: 0 }, "3": { max: 2, used: 0 } },
      grantUses: {},
      known: spells,
      prepared: spells.filter((s) => s.prepared),
    },
  } as CharacterData;
}

describe("formatSpellCombatSubtitle", () => {
  it("formats cantrips and leveled spells with range on the button", () => {
    assert.equal(formatSpellCombatSubtitle(0, "30 feet"), "Cantrip · 30 feet");
    assert.equal(formatSpellCombatSubtitle(0), "Cantrip");
    assert.equal(formatSpellCombatSubtitle(1, "120 feet"), "Spell 1 · 120 feet");
    assert.equal(formatSpellCombatSubtitle(2), "Spell 2");
  });
});

describe("formatDeclareCastSpellSubtitle", () => {
  it("shows cantrip range from the catalog", () => {
    const character = baseCharacter([
      spell({ name: "Mage Hand", level: 0, prepared: true, spellId: "mage-hand" }),
    ]);
    assert.equal(
      formatDeclareCastSpellSubtitle(character.spells.known[0]!, "mage-hand"),
      "Cantrip · 30 feet"
    );
  });

  it("shows spell level and range for leveled declare-cast spells", () => {
    const character = baseCharacter([
      spell({ name: "Bless", level: 1, prepared: true, spellId: "bless" }),
    ]);
    assert.equal(
      formatDeclareCastSpellSubtitle(character.spells.known[0]!, "bless"),
      "Spell 1 · 30 feet"
    );
  });

  it("omits spell level but keeps range for bonus-action leveled spells before slot selection", () => {
    const character = baseCharacter([
      spell({
        name: "Healing Word",
        level: 1,
        prepared: true,
        spellId: "healing-word",
      }),
    ]);
    assert.equal(
      formatDeclareCastSpellSubtitle(character.spells.known[0]!, "healing-word", {
        omitSpellLevel: true,
      }),
      "Spell · 60 feet"
    );
  });
});

describe("getSpellCastingCost", () => {
  it("recognizes action, bonus action, and reaction casting times", () => {
    assert.equal(getSpellCastingCost("1 action"), "action");
    assert.equal(getSpellCastingCost("1 bonus action"), "bonus-action");
    assert.equal(
      getSpellCastingCost("1 reaction, which you take when you are hit by an attack"),
      "reaction"
    );
  });

  it("rejects non-combat casting times", () => {
    assert.equal(getSpellCastingCost("1 minute"), null);
    assert.equal(getSpellCastingCost("10 minutes"), null);
    assert.equal(getSpellCastingCost("1 hour"), null);
  });
});

describe("listCombatCastableLeveledSpells", () => {
  it("includes offensive and utility prepared spells for the picker", () => {
    const character = baseCharacter([
      spell({ name: "Bless", level: 1, prepared: true, spellId: "bless" }),
      spell({
        name: "Guiding Bolt",
        level: 1,
        prepared: true,
        spellId: "guiding-bolt",
      }),
    ]);

    const slugs = listCombatCastableLeveledSpells(character, {
      castingCost: "action",
    }).map((entry) => entry.slug);
    assert.deepEqual(slugs, ["bless", "guiding-bolt"]);
  });

  it("filters bonus-action spells into the bonus-action picker list", () => {
    const character = baseCharacter([
      spell({
        name: "Healing Word",
        level: 1,
        prepared: true,
        spellId: "healing-word",
      }),
    ]);

    const actionSlugs = listCombatCastableLeveledSpells(character, {
      castingCost: "action",
    }).map((entry) => entry.slug);
    const bonusSlugs = listCombatCastableLeveledSpells(character, {
      castingCost: "bonus-action",
    }).map((entry) => entry.slug);
    assert.deepEqual(actionSlugs, []);
    assert.deepEqual(bonusSlugs, ["healing-word"]);
  });

  it("excludes unprepared leveled spells and spells without slots", () => {
    const character = baseCharacter([
      spell({ name: "Bless", level: 1, prepared: false, spellId: "bless" }),
    ]);
    character.spells.slots = { "1": { max: 2, used: 2 } };
    character.spells.known.push(
      spell({ name: "Cure Wounds", level: 1, prepared: true, spellId: "cure-wounds" })
    );

    const slugs = listCombatCastableLeveledSpells(character, {
      castingCost: "action",
    }).map((entry) => entry.slug);
    assert.deepEqual(slugs, []);
  });
});

describe("listCombatCastableCantripSpells", () => {
  it("includes non-offensive cantrips only", () => {
    const character = baseCharacter([
      spell({ name: "Mage Hand", level: 0, prepared: true, spellId: "mage-hand" }),
      spell({ name: "Sacred Flame", level: 0, prepared: true, spellId: "sacred-flame" }),
    ]);

    const slugs = listCombatCastableCantripSpells(character, {
      castingCost: "action",
    }).map((entry) => entry.slug);
    assert.deepEqual(slugs, ["mage-hand"]);
  });
});

describe("getEligibleCastSlotLevels", () => {
  it("returns slot levels at or above the spell level with remaining uses", () => {
    const character = baseCharacter([
      spell({ name: "Bless", level: 1, prepared: true, spellId: "bless" }),
    ]);
    character.spells.slots = {
      "1": { max: 4, used: 4 },
      "2": { max: 3, used: 1 },
      "3": { max: 2, used: 2 },
    };

    const levels = getEligibleCastSlotLevels(character.spells.slots, 1).map(
      (slot) => slot.slotLevel
    );
    assert.deepEqual(levels, [2]);
  });
});

describe("listCombatCastableActionSpellsForPicker", () => {
  it("includes utility cantrips and leveled action spells", () => {
    const character = baseCharacter([
      spell({ name: "Mage Hand", level: 0, prepared: true, spellId: "mage-hand" }),
      spell({ name: "Sacred Flame", level: 0, prepared: true, spellId: "sacred-flame" }),
      spell({ name: "Bless", level: 1, prepared: true, spellId: "bless" }),
    ]);

    const slugs = listCombatCastableActionSpellsForPicker(character).map(
      (entry) => entry.slug
    );
    assert.deepEqual(slugs, ["mage-hand", "bless"]);
  });

  it("excludes ritual and long-casting spells that cannot be used in battle", () => {
    const character = baseCharacter([
      spell({ name: "Mending", level: 0, prepared: true, spellId: "mending" }),
      spell({ name: "Alarm", level: 1, prepared: true, spellId: "alarm" }),
      spell({
        name: "Find Familiar",
        level: 1,
        prepared: true,
        spellId: "find-familiar",
      }),
      spell({ name: "Identify", level: 1, prepared: true, spellId: "identify" }),
      spell({
        name: "Detect Magic",
        level: 1,
        prepared: true,
        spellId: "detect-magic",
      }),
      spell({ name: "Bless", level: 1, prepared: true, spellId: "bless" }),
    ]);

    const slugs = listCombatCastableActionSpellsForPicker(character).map(
      (entry) => entry.slug
    );
    assert.deepEqual(slugs.sort(), ["bless", "detect-magic"]);
  });
});

describe("listCombatCastableSpells", () => {
  it("aggregates cantrip and leveled combat spells", () => {
    const character = baseCharacter([
      spell({ name: "Mage Hand", level: 0, prepared: true, spellId: "mage-hand" }),
      spell({ name: "Bless", level: 1, prepared: true, spellId: "bless" }),
    ]);

    const slugs = listCombatCastableSpells(character).map((entry) => entry.slug);
    assert.deepEqual(slugs, ["mage-hand", "bless"]);
  });
});

describe("deriveSpellAttacks", () => {
  it("only derives offensive cantrips as attack buttons", () => {
    const character = baseCharacter([
      spell({
        name: "Fire Bolt",
        level: 0,
        prepared: true,
        spellId: "fire-bolt",
      }),
      spell({
        name: "Guiding Bolt",
        level: 1,
        prepared: true,
        spellId: "guiding-bolt",
      }),
      spell({
        name: "Hellish Rebuke",
        level: 1,
        prepared: true,
        spellId: "hellish-rebuke",
      }),
    ]);

    const slugs = deriveSpellAttacks(character)
      .map((attack) => attack.spellCatalogSlug)
      .filter(Boolean);
    assert.deepEqual(slugs, ["fire-bolt"]);
  });
});
