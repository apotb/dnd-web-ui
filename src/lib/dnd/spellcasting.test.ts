import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PHB_CLASSES } from "@/lib/dnd/phb/classes";
import type { Spell } from "@/lib/schemas/character";
import {
  applyPreparedSelection,
  buildSpellSlots,
  canAddLeveledSpell,
  canAddLeveledSpellToSpellbook,
  canAddSpellsOnSheet,
  canEditSpellOnSheet,
  canModifyPlayerCantrips,
  canModifyPlayerSpells,
  canPrepareAnother,
  canReprepareSpellsOnLongRest,
  canShowDmCantripEditToggle,
  getDmSpellEditToggleLabel,
  canUseClassSpellcasting,
  classHasSpellcastingAtLevel,
  countPlayerPreparedLeveled,
  enforcePreparedLimit,
  formatCantripCountDisplay,
  formatPreparedSpellsCountDisplay,
  formatSpellsKnownCountDisplay,
  formatLevelPreparedSummary,
  getPreparedSpellLimit,
  getPreparedSpellPickCount,
  getSpellcastingFeatureDescription,
  getSpellcastingLimits,
  getSpellcastingSheetSpells,
  getSpellsKnownLimit,
  getSpellsKnownPickCount,
  getWizardSpellbookSpells,
  isFullListPreparedCaster,
  isKnownCaster,
  isPlayerCantrip,
  isWizardSpellbookSpell,
  migrateFullListPreparedCasterSpells,
  applySpellSlotUsed,
} from "./spellcasting";
import type { CharacterData } from "@/lib/schemas/character";

const cleric = PHB_CLASSES.find((c) => c.id === "cleric")!;
const wizard = PHB_CLASSES.find((c) => c.id === "wizard")!;
const paladin = PHB_CLASSES.find((c) => c.id === "paladin")!;
const ranger = PHB_CLASSES.find((c) => c.id === "ranger")!;
const bard = PHB_CLASSES.find((c) => c.id === "bard")!;
const warlock = PHB_CLASSES.find((c) => c.id === "warlock")!;

const defaultScores = {
  str: 10,
  dex: 10,
  con: 10,
  int: 10,
  wis: 14,
  cha: 10,
};

function spell(overrides: Partial<Spell> & Pick<Spell, "name" | "level">): Spell {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name,
    level: overrides.level,
    prepared: overrides.prepared ?? false,
    notes: overrides.notes ?? "",
    ...overrides,
  };
}

describe("isPlayerCantrip and canModifyPlayerCantrips", () => {
  it("identifies player cantrips vs grant cantrips", () => {
    assert.equal(
      isPlayerCantrip(spell({ name: "Sacred Flame", level: 0, spellId: "sacred-flame" })),
      true
    );
    assert.equal(
      isPlayerCantrip(
        spell({
          name: "Light",
          level: 0,
          spellId: "light",
          grantKey: "grant:subclass:light-domain-cantrip",
        })
      ),
      false
    );
    assert.equal(
      isPlayerCantrip(spell({ name: "Bless", level: 1, spellId: "bless" })),
      false
    );
  });

  it("allows cantrip edits only when DM has edit mode enabled", () => {
    assert.equal(canModifyPlayerCantrips(false, false), false);
    assert.equal(canModifyPlayerCantrips(false, true), false);
    assert.equal(canModifyPlayerCantrips(true, false), false);
    assert.equal(canModifyPlayerCantrips(true, true), true);
  });
});

describe("getSpellcastingFeatureDescription", () => {
  it("describes full-list prepared casters", () => {
    const desc = getSpellcastingFeatureDescription(cleric);
    assert.match(desc, /Full caster/);
    assert.match(desc, /prepare from class list/i);
  });

  it("describes wizard spellbook casters", () => {
    const desc = getSpellcastingFeatureDescription(wizard);
    assert.match(desc, /Full caster/);
    assert.match(desc, /spellbook/i);
  });

  it("describes known casters", () => {
    const desc = getSpellcastingFeatureDescription(bard);
    assert.match(desc, /Full caster/);
    assert.match(desc, /spells known/i);
  });

  it("describes pact casters", () => {
    const desc = getSpellcastingFeatureDescription(warlock);
    assert.match(desc, /Pact caster/);
    assert.match(desc, /short rest/i);
  });
});

describe("wizard spell sheet permissions", () => {
  it("identifies wizard spellbook spells", () => {
    const bookSpell = spell({ name: "Alarm", level: 1, spellId: "alarm" });
    assert.equal(isWizardSpellbookSpell(bookSpell, wizard), true);
    assert.equal(isWizardSpellbookSpell(bookSpell, cleric), false);
    assert.equal(
      isWizardSpellbookSpell(
        spell({
          name: "Light",
          level: 0,
          spellId: "light",
          grantKey: "grant:feat:magic-initiate:cantrip:0",
        }),
        wizard
      ),
      false
    );
  });

  it("lists wizard spellbook spells sorted by level then name", () => {
    const known = [
      spell({ name: "Charm Person", level: 1, spellId: "charm-person" }),
      spell({ name: "Alarm", level: 1, spellId: "alarm" }),
      spell({ name: "Fire Bolt", level: 0, spellId: "fire-bolt" }),
      spell({ name: "Detect Magic", level: 1, spellId: "detect-magic" }),
      spell({
        name: "Bless",
        level: 1,
        spellId: "bless",
        grantKey: "grant:subclass:domain-spell:life:bless",
      }),
    ];
    const book = getWizardSpellbookSpells(known);
    assert.equal(book.length, 3);
    assert.deepEqual(
      book.map((s) => s.spellId),
      ["alarm", "charm-person", "detect-magic"]
    );
  });

  it("requires DM edit mode for wizard, known casters, and no-cantrip prepared caster spell changes", () => {
    assert.equal(canModifyPlayerSpells(true, true, wizard, 2), true);
    assert.equal(canModifyPlayerSpells(true, false, wizard, 2), false);
    assert.equal(canModifyPlayerSpells(true, true, cleric, 1), false);
    assert.equal(canModifyPlayerSpells(true, true, paladin, 2), true);
    assert.equal(canModifyPlayerSpells(true, true, paladin, 1), false);
    assert.equal(canModifyPlayerSpells(true, true, bard, 1), true);
    assert.equal(canModifyPlayerSpells(true, false, bard, 1), false);
  });

  it("locks wizard spells on the sheet unless DM edit mode is on", () => {
    const cantrip = spell({ name: "Fire Bolt", level: 0, spellId: "fire-bolt" });
    const bookSpell = spell({ name: "Alarm", level: 1, spellId: "alarm" });

    assert.equal(canEditSpellOnSheet(cantrip, wizard, false, false, 1), false);
    assert.equal(canEditSpellOnSheet(bookSpell, wizard, true, false, 1), false);
    assert.equal(canEditSpellOnSheet(cantrip, wizard, true, true, 1), true);
    assert.equal(canEditSpellOnSheet(bookSpell, wizard, true, true, 1), true);
  });

  it("locks paladin spells on the sheet unless DM edit mode is on", () => {
    const leveled = spell({ name: "Bless", level: 1, spellId: "bless", prepared: true });

    assert.equal(canEditSpellOnSheet(leveled, paladin, false, false, 2), false);
    assert.equal(canEditSpellOnSheet(leveled, paladin, true, false, 2), false);
    assert.equal(canEditSpellOnSheet(leveled, paladin, true, true, 2), true);
    assert.equal(canAddSpellsOnSheet(paladin, true, true, 2), true);
    assert.equal(canAddSpellsOnSheet(paladin, true, false, 2), false);
  });

  it("locks known caster leveled spells on the sheet unless DM edit mode is on", () => {
    const leveled = spell({ name: "Charm Person", level: 1, spellId: "charm-person" });
    assert.equal(canEditSpellOnSheet(leveled, bard, false, false), false);
    assert.equal(canEditSpellOnSheet(leveled, bard, true, true, 1), true);
    assert.equal(canAddSpellsOnSheet(bard, false, false), false);
    assert.equal(canAddSpellsOnSheet(bard, true, true, 1), true);
    assert.equal(canAddSpellsOnSheet(wizard, true, false), false);
  });
});

describe("isFullListPreparedCaster", () => {
  it("is true for cleric, druid, and paladin", () => {
    const druid = PHB_CLASSES.find((c) => c.id === "druid")!;
    assert.equal(isFullListPreparedCaster(cleric), true);
    assert.equal(isFullListPreparedCaster(druid), true);
    assert.equal(isFullListPreparedCaster(paladin), true);
    assert.equal(isFullListPreparedCaster(ranger), false);
  });

  it("is false for wizard and known casters", () => {
    assert.equal(isFullListPreparedCaster(wizard), false);
    assert.equal(isFullListPreparedCaster(bard), false);
  });
});

describe("canAddLeveledSpell", () => {
  it("blocks full-list prepared casters from manual leveled adds", () => {
    const limits = getSpellcastingLimits(cleric, 3, defaultScores);
    assert.equal(canAddLeveledSpell([], limits), false);
  });

  it("allows wizard spellbook adds", () => {
    const limits = getSpellcastingLimits(wizard, 3, defaultScores);
    assert.equal(canAddLeveledSpell([], limits), true);
    assert.equal(canAddLeveledSpellToSpellbook(limits), true);
  });

  it("enforces known limits for bards", () => {
    const limits = getSpellcastingLimits(bard, 1, defaultScores);
    assert.equal(canAddLeveledSpell([], limits), true);
    const atLimit = Array.from({ length: limits.spellsKnown! }, (_, i) =>
      spell({ name: `Spell ${i}`, level: 1, spellId: `spell-${i}` })
    );
    assert.equal(canAddLeveledSpell(atLimit, limits), false);
  });
});

describe("applyPreparedSelection", () => {
  it("keeps cantrips and grants while replacing prepared leveled spells", () => {
    const known: Spell[] = [
      spell({ name: "Sacred Flame", level: 0, spellId: "sacred-flame", prepared: true }),
      spell({
        name: "Bless",
        level: 1,
        spellId: "bless",
        prepared: true,
        id: "bless-row",
      }),
      spell({
        name: "Cure Wounds",
        level: 1,
        spellId: "cure-wounds",
        prepared: false,
      }),
      spell({
        name: "Granted",
        level: 1,
        spellId: "command",
        prepared: true,
        grantKey: "grant:feat:magic-initiate",
      }),
    ];

    const next = applyPreparedSelection(
      known,
      [
        { slug: "shield-of-faith", name: "Shield of Faith", level: 1, school: "Abjuration" },
        { slug: "bless", name: "Bless", level: 1, school: "Enchantment" },
      ],
      2
    );

    assert.equal(next.length, 4);
    assert.ok(next.some((s) => s.spellId === "sacred-flame"));
    assert.ok(next.some((s) => s.grantKey === "grant:feat:magic-initiate"));
    assert.ok(!next.some((s) => s.spellId === "cure-wounds"));
    const bless = next.find((s) => s.spellId === "bless");
    assert.equal(bless?.id, "bless-row");
    assert.equal(bless?.prepared, true);
    assert.ok(next.some((s) => s.spellId === "shield-of-faith" && s.prepared));
  });

  it("caps selection at the prepare limit", () => {
    const next = applyPreparedSelection(
      [],
      [
        { slug: "a", name: "A", level: 1, school: "Evocation" },
        { slug: "b", name: "B", level: 1, school: "Evocation" },
        { slug: "c", name: "C", level: 1, school: "Evocation" },
      ],
      2
    );
    assert.equal(next.length, 2);
  });

  it("updates prepared flags on wizard spellbook entries without dropping the book", () => {
    const known: Spell[] = [
      spell({ name: "Fire Bolt", level: 0, spellId: "fire-bolt", prepared: true }),
      spell({
        name: "Shield",
        level: 1,
        spellId: "shield",
        prepared: true,
        id: "shield-row",
      }),
      spell({
        name: "Magic Missile",
        level: 1,
        spellId: "magic-missile",
        prepared: false,
        id: "mm-row",
      }),
    ];

    const next = applyPreparedSelection(
      known,
      [
        { slug: "magic-missile", name: "Magic Missile", level: 1, school: "Evocation" },
      ],
      2,
      { wizardSpellbook: true }
    );

    assert.equal(next.length, 3);
    assert.equal(next.find((s) => s.spellId === "shield")?.prepared, false);
    assert.equal(next.find((s) => s.spellId === "magic-missile")?.prepared, true);
    assert.equal(next.find((s) => s.spellId === "magic-missile")?.id, "mm-row");
  });
});

describe("formatLevelPreparedSummary", () => {
  it("excludes always-prepared grant spells from per-level prepared count", () => {
    const spellsAtLevel = [
      spell({
        name: "Bless",
        level: 1,
        spellId: "bless",
        prepared: true,
        grantKey: "grant:subclass:domain-spell:life:bless",
      }),
      spell({
        name: "Cure Wounds",
        level: 1,
        spellId: "cure-wounds",
        prepared: true,
        grantKey: "grant:subclass:domain-spell:life:cure-wounds",
      }),
      spell({ name: "Guiding Bolt", level: 1, spellId: "guiding-bolt", prepared: true }),
    ];
    assert.equal(
      formatLevelPreparedSummary(spellsAtLevel, 1, {
        usesPreparedList: true,
        preparedSpellLimit: 4,
      }),
      "Prepared: 1/4"
    );
  });
});

describe("countPlayerPreparedLeveled and enforcePreparedLimit", () => {
  it("excludes managed grant spells from player prepare count", () => {
    const known = [
      spell({ name: "Bless", level: 1, spellId: "bless", prepared: true, grantKey: "grant:subclass:domain-spell:life:bless" }),
      spell({ name: "Cure Wounds", level: 1, spellId: "cure-wounds", prepared: true, grantKey: "grant:subclass:domain-spell:life:cure-wounds" }),
      spell({ name: "Guiding Bolt", level: 1, spellId: "guiding-bolt", prepared: true }),
      spell({ name: "Healing Word", level: 1, spellId: "healing-word", prepared: true }),
    ];
    assert.equal(countPlayerPreparedLeveled(known), 2);
    assert.equal(canPrepareAnother(known, 4), true);
  });

  it("keeps grant spells when trimming excess player-prepared spells", () => {
    const known = [
      spell({ name: "Bless", level: 1, spellId: "bless", prepared: true, grantKey: "grant:subclass:domain-spell:life:bless" }),
      spell({ name: "Cure Wounds", level: 1, spellId: "cure-wounds", prepared: true, grantKey: "grant:subclass:domain-spell:life:cure-wounds" }),
      spell({ name: "A", level: 1, spellId: "a", prepared: true }),
      spell({ name: "B", level: 1, spellId: "b", prepared: true }),
      spell({ name: "C", level: 1, spellId: "c", prepared: true }),
      spell({ name: "D", level: 1, spellId: "d", prepared: true }),
      spell({ name: "E", level: 1, spellId: "e", prepared: true }),
    ];
    const trimmed = enforcePreparedLimit(known, 4);
    assert.equal(countPlayerPreparedLeveled(trimmed), 4);
    assert.equal(
      trimmed.filter((s) => s.grantKey?.startsWith("grant:")).length,
      2
    );
  });
});

describe("canReprepareSpellsOnLongRest", () => {
  it("is true for cleric, druid, and wizard", () => {
    const druid = PHB_CLASSES.find((c) => c.id === "druid")!;
    assert.equal(canReprepareSpellsOnLongRest(cleric), true);
    assert.equal(canReprepareSpellsOnLongRest(druid), true);
    assert.equal(canReprepareSpellsOnLongRest(wizard), true);
  });

  it("is false for known casters", () => {
    const bard = PHB_CLASSES.find((c) => c.id === "bard")!;
    assert.equal(canReprepareSpellsOnLongRest(bard), false);
    assert.equal(canReprepareSpellsOnLongRest(ranger), false);
  });
});

describe("migrateFullListPreparedCasterSpells", () => {
  it("merges legacy prepared array and strips unprepared leveled orphans", () => {
    const data = {
      spells: {
        known: [
          spell({ name: "Sacred Flame", level: 0, spellId: "sacred-flame", prepared: true }),
          spell({ name: "Orphan", level: 1, spellId: "orphan", prepared: false }),
        ],
        prepared: [
          spell({ name: "Bless", level: 1, spellId: "bless", prepared: true }),
        ],
        slots: {},
        grantUses: {},
        spellcastingHidden: false,
      },
    } as CharacterData;

    const migrated = migrateFullListPreparedCasterSpells(data, cleric);
    assert.ok(migrated.spells.known.some((s) => s.spellId === "bless"));
    assert.ok(!migrated.spells.known.some((s) => s.spellId === "orphan"));
    assert.ok(migrated.spells.known.some((s) => s.spellId === "sacred-flame"));
  });

  it("no-ops for non full-list casters", () => {
    const data = {
      spells: {
        known: [spell({ name: "Vicious Mockery", level: 0, spellId: "vicious-mockery" })],
        prepared: [],
        slots: {},
        grantUses: {},
        spellcastingHidden: false,
      },
    } as CharacterData;
    const migrated = migrateFullListPreparedCasterSpells(data, bard);
    assert.equal(migrated.spells.known.length, 1);
  });
});

describe("applySpellSlotUsed", () => {
  it("increments used count for the chosen slot level", () => {
    const slots = { "1": { max: 4, used: 1 }, "2": { max: 3, used: 0 } };
    const next = applySpellSlotUsed(slots, 2);
    assert.deepEqual(next, {
      "1": { max: 4, used: 1 },
      "2": { max: 3, used: 1 },
    });
  });

  it("returns null when no slot remains at the chosen level", () => {
    const slots = { "1": { max: 2, used: 2 } };
    assert.equal(applySpellSlotUsed(slots, 1), null);
  });

  it("no-ops for cantrip casts", () => {
    const slots = { "1": { max: 2, used: 0 } };
    assert.equal(applySpellSlotUsed(slots, 0), slots);
  });
});

describe("paladin half-caster spellcasting", () => {
  const scores = {
    str: 16,
    dex: 10,
    con: 14,
    int: 10,
    wis: 10,
    cha: 14,
  };

  it("has no spellcasting at level 1", () => {
    assert.equal(classHasSpellcastingAtLevel(paladin, 1), false);
    const slots = buildSpellSlots(paladin, 1);
    assert.deepEqual(slots, {});
  });

  it("gains half-caster slots and prepare limit at level 2", () => {
    assert.equal(classHasSpellcastingAtLevel(paladin, 2), true);
    const slots = buildSpellSlots(paladin, 2);
    assert.deepEqual(slots, { "1": { max: 2, used: 0 } });
    assert.equal(getPreparedSpellLimit(paladin, 2, scores), 3);
    assert.match(getSpellcastingFeatureDescription(paladin), /Half caster/i);
  });

  it("returns inactive limits before spellcasting unlocks", () => {
    const limits = getSpellcastingLimits(paladin, 1, scores);
    assert.equal(limits.cantripsKnown, 0);
    assert.equal(limits.preparedSpells, null);
    assert.equal(limits.spellsKnown, null);
  });

  it("returns active limits after spellcasting unlocks", () => {
    const limits = getSpellcastingLimits(paladin, 2, scores);
    assert.equal(limits.cantripsKnown, 0);
    assert.equal(limits.preparedSpells, 3);
  });
});

describe("ranger half-caster spellcasting", () => {
  const scores = {
    str: 10,
    dex: 14,
    con: 12,
    int: 10,
    wis: 14,
    cha: 10,
  };

  it("has no spellcasting at level 1", () => {
    assert.equal(classHasSpellcastingAtLevel(ranger, 1), false);
    assert.equal(canUseClassSpellcasting(ranger, 1), false);
    assert.equal(isKnownCaster(ranger), true);
    assert.equal(isFullListPreparedCaster(ranger), false);
    assert.equal(canReprepareSpellsOnLongRest(ranger), false);
    const slots = buildSpellSlots(ranger, 1);
    assert.deepEqual(slots, {});
  });

  it("gains half-caster slots and spells known at level 2", () => {
    assert.equal(classHasSpellcastingAtLevel(ranger, 2), true);
    assert.equal(canUseClassSpellcasting(ranger, 2), true);
    const slots = buildSpellSlots(ranger, 2);
    assert.deepEqual(slots, { "1": { max: 2, used: 0 } });
    assert.equal(getSpellsKnownLimit(ranger, 2), 2);
    assert.equal(getSpellsKnownPickCount(ranger, 1, 2), 2);
    assert.match(getSpellcastingFeatureDescription(ranger), /spells known/i);
    const limits = getSpellcastingLimits(ranger, 2, scores);
    assert.equal(limits.spellsKnown, 2);
    assert.equal(limits.preparedSpells, null);
    assert.equal(limits.usesPreparedList, false);
  });

  it("returns inactive limits before spellcasting unlocks", () => {
    const limits = getSpellcastingLimits(ranger, 1, scores);
    assert.equal(limits.preparedSpells, null);
    assert.equal(limits.spellsKnown, null);
  });
});

describe("canShowDmCantripEditToggle", () => {
  it("is false before half-caster spellcasting unlocks", () => {
    assert.equal(canShowDmCantripEditToggle(paladin, 1), false);
    assert.equal(canShowDmCantripEditToggle(ranger, 1), false);
  });

  it("is true for half-casters once spellcasting unlocks", () => {
    assert.equal(canShowDmCantripEditToggle(paladin, 2), true);
    assert.equal(canShowDmCantripEditToggle(ranger, 2), true);
    assert.equal(getDmSpellEditToggleLabel(paladin, 2), "Edit spells");
    assert.equal(getDmSpellEditToggleLabel(ranger, 2), "Edit spells");
  });

  it("is true for cleric at level 1", () => {
    assert.equal(canShowDmCantripEditToggle(cleric, 1), true);
    assert.equal(getDmSpellEditToggleLabel(cleric, 1), "Edit cantrips");
  });

  it("is true for wizard at level 1", () => {
    assert.equal(canShowDmCantripEditToggle(wizard, 1), true);
    assert.equal(getDmSpellEditToggleLabel(wizard, 1), "Edit spells");
  });
});

describe("formatCantripCountDisplay", () => {
  it("shows merged total for grant-only cantrips", () => {
    assert.equal(
      formatCantripCountDisplay([
        spell({
          name: "Light",
          level: 0,
          spellId: "light",
          grantKey: "grant:species",
        }),
      ]),
      "Cantrips: 1"
    );
    assert.equal(formatCantripCountDisplay([]), null);
  });

  it("merges player and grant cantrips into one total", () => {
    assert.equal(
      formatCantripCountDisplay([
        spell({ name: "Fire Bolt", level: 0, spellId: "fire-bolt" }),
        spell({
          name: "Light",
          level: 0,
          spellId: "light",
          grantKey: "grant:species",
        }),
      ]),
      "Cantrips: 2"
    );
  });
});

describe("formatSpellsKnownCountDisplay", () => {
  it("merges player and grant leveled spells", () => {
    assert.equal(
      formatSpellsKnownCountDisplay([
        spell({ name: "Charm Person", level: 1, spellId: "charm-person" }),
        spell({
          name: "Bless",
          level: 1,
          spellId: "bless",
          prepared: true,
          grantKey: "grant:domain",
        }),
      ]),
      "Spells known: 2"
    );
  });
});

describe("formatPreparedSpellsCountDisplay", () => {
  it("includes always-prepared grant spells", () => {
    assert.equal(
      formatPreparedSpellsCountDisplay([
        spell({ name: "Cure Wounds", level: 1, spellId: "cure-wounds", prepared: true }),
        spell({
          name: "Bless",
          level: 1,
          spellId: "bless",
          prepared: true,
          grantKey: "grant:domain",
        }),
        spell({ name: "Shield", level: 1, spellId: "shield", prepared: false }),
      ]),
      "Prepared spells: 2"
    );
  });
});

describe("getSpellcastingSheetSpells", () => {
  it("filters unprepared wizard spellbook spells from the sheet list", () => {
    const known = [
      spell({ name: "Fire Bolt", level: 0, spellId: "fire-bolt", prepared: true }),
      spell({ name: "Alarm", level: 1, spellId: "alarm", prepared: true }),
      spell({ name: "Feather Fall", level: 1, spellId: "feather-fall", prepared: false }),
    ];
    const sheetSpells = getSpellcastingSheetSpells(known, wizard);
    assert.equal(sheetSpells.length, 2);
    assert.ok(sheetSpells.some((s) => s.spellId === "alarm"));
    assert.ok(!sheetSpells.some((s) => s.spellId === "feather-fall"));
  });

  it("returns all known spells for non-wizard casters", () => {
    const known = [
      spell({ name: "Vicious Mockery", level: 0, spellId: "vicious-mockery" }),
      spell({
        name: "Hunter's Mark",
        level: 1,
        spellId: "hunters-mark",
        prepared: false,
      }),
    ];
    assert.deepEqual(getSpellcastingSheetSpells(known, bard), known);
    assert.deepEqual(getSpellcastingSheetSpells(known, ranger), known);
  });
});
