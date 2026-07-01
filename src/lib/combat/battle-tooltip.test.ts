import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CharacterActionEntry } from "@/lib/dnd/character-actions";
import type { DerivedAttack } from "@/lib/dnd/attacks";
import type { CharacterData } from "@/lib/schemas/character";
import {
  formatBattleActionTooltip,
  formatBattleAttackTooltip,
  buildBattleAttackTooltipParts,
  formatBattleTooltip,
} from "./battle-tooltip";
import { formatSpellPickerCombatTooltip } from "@/lib/dnd/combat-spells";
import type { Spell } from "@/lib/schemas/character";

const baseCharacter = {
  basicInfo: { xp: 0 },
  combat: { conditions: [] },
  exhaustionLevels: [],
} as CharacterData;

function meleeAttack(overrides: Partial<DerivedAttack> = {}): DerivedAttack {
  return {
    id: "weapon-longsword",
    name: "Longsword",
    attackBonus: 7,
    damageDice: "1d8",
    damageType: "slashing",
    range: "5 ft",
    notes: "Off-hand",
    source: "weapon",
    rollType: "attack",
    ...overrides,
  };
}

const dashAction: CharacterActionEntry = {
  id: "core:dash",
  name: "Dash",
  cost: "action",
  description: "Gain extra movement equal to your speed for this turn.",
  source: "core",
  sourceLabel: "Standard",
};

describe("formatBattleTooltip", () => {
  it("inserts a blank line before the description", () => {
    assert.equal(
      formatBattleTooltip({
        metadata: ["Cost: Action"],
        description: "Take the Dash action.",
      }),
      "Cost: Action\n\nTake the Dash action."
    );
  });
});

describe("buildBattleAttackTooltipParts", () => {
  it("returns labeled metadata lines matching the tooltip string", () => {
    const parts = buildBattleAttackTooltipParts(meleeAttack(), baseCharacter, {
      omitBonusActionNote: true,
    });

    assert.deepEqual(parts.metadata, [
      "To hit: +7",
      "Damage: 1d8 slashing",
      "Range: 5 ft",
    ]);
    assert.equal(parts.description, "Off-hand");
    assert.equal(formatBattleTooltip(parts), formatBattleAttackTooltip(meleeAttack(), baseCharacter, {
      omitBonusActionNote: true,
    }));
  });
});

describe("formatBattleAttackTooltip", () => {
  it("labels weapon attack metadata and separates notes after a blank line", () => {
    const tooltip = formatBattleAttackTooltip(meleeAttack(), baseCharacter, {
      omitBonusActionNote: true,
    });

    assert.equal(
      tooltip,
      [
        "Melee",
        "To hit: +7",
        "Damage: 1d8 slashing",
        "Range: 5 ft",
        "",
        "Off-hand",
      ].join("\n")
    );
  });

  it("includes cantrip spell descriptions for offensive spell attacks", () => {
    const tooltip = formatBattleAttackTooltip(
      meleeAttack({
        id: "spell-fire-bolt",
        name: "Fire Bolt",
        source: "cantrip",
        spellCatalogSlug: "fire-bolt",
        damageDice: "1d10",
        damageType: "fire",
        range: "120 feet",
        notes: "",
      }),
      baseCharacter
    );

    assert.match(tooltip, /^Fire Bolt\nEvocation · V, S\n/);
    assert.match(tooltip, /To hit: \+\d/);
    assert.match(tooltip, /Damage: 1d10 fire/);
    assert.match(tooltip, /Range: 120 feet/);
    assert.match(tooltip, /\n\nHurl a mote of fire/);
    assert.doesNotMatch(tooltip, /\nCantrip\n/);
    assert.doesNotMatch(tooltip, /\n\nEvocation$/);
  });

  it("omits redundant school notes after the spell description", () => {
    const tooltip = formatBattleAttackTooltip(
      meleeAttack({
        id: "spell-fire-bolt",
        name: "Fire Bolt",
        source: "cantrip",
        spellCatalogSlug: "fire-bolt",
        damageDice: "1d10",
        damageType: "fire",
        range: "120 feet",
        notes: "Evocation",
      }),
      baseCharacter
    );

    assert.doesNotMatch(tooltip, /\n\nEvocation$/);
  });

  it("appends ignores cover to the range line for eligible cantrips", () => {
    const tooltip = formatBattleAttackTooltip(
      meleeAttack({
        id: "spell-sacred-flame",
        name: "Sacred Flame",
        source: "cantrip",
        spellCatalogSlug: "sacred-flame",
        rollType: "save",
        saveDc: 13,
        saveAbility: "Dexterity",
        damageDice: "1d8",
        damageType: "radiant",
        range: "60 ft",
        notes: "Ignores cover",
      }),
      baseCharacter
    );

    assert.match(tooltip, /^Sacred Flame\nEvocation · V, S\n/);
    assert.match(tooltip, /Range: 60 ft · Ignores cover/);
    assert.doesNotMatch(tooltip, /^Ignores cover$/m);
  });

  it("places versatile damage immediately after damage", () => {
    const tooltip = formatBattleAttackTooltip(
      meleeAttack({
        damageDice: "1d8+3",
        versatileDamageDice: "1d10+3",
        notes: "Versatile (two-handed): 1d10+3, Finesse",
      }),
      baseCharacter
    );

    const damageIndex = tooltip.indexOf("Damage: 1d8+3 slashing");
    const versatileIndex = tooltip.indexOf("Versatile: 1d10+3 slashing");
    const rangeIndex = tooltip.indexOf("Range:");
    assert.ok(damageIndex >= 0);
    assert.ok(versatileIndex > damageIndex);
    assert.ok(rangeIndex > versatileIndex);
    assert.match(tooltip, /\n\nFinesse$/);
    assert.doesNotMatch(tooltip, /Versatile \(two-handed\)/);
  });

  it("labels saving throw attacks", () => {
    const tooltip = formatBattleAttackTooltip(
      meleeAttack({
        rollType: "save",
        saveDc: 15,
        saveAbility: "Dexterity",
        attackBonus: 0,
        notes: "",
      }),
      baseCharacter
    );

    assert.match(tooltip, /Save: DC 15 Dexterity/);
  });
});

describe("formatBattleActionTooltip", () => {
  it("shows the description with uses in the footer", () => {
    const action: CharacterActionEntry = {
      ...dashAction,
      uses: { current: 1, max: 3 },
      restReset: "short",
    };

    assert.equal(
      formatBattleActionTooltip(action),
      [
        "Gain extra movement equal to your speed for this turn.",
        "Uses: 1/3 (short rest)",
      ].join("\n")
    );
  });
});

describe("formatSpellPickerCombatTooltip", () => {
  it("places attack metadata before the spell description", () => {
    const spell: Spell = {
      id: "1",
      name: "Fire Bolt",
      level: 0,
      prepared: true,
      notes: "",
      spellId: "fire-bolt",
    };

    const character = {
      basicInfo: { xp: 6500, level: 5 },
      abilityScores: { str: 10, dex: 14, con: 10, int: 16, wis: 10, cha: 10 },
      spells: {
        spellcastingAbility: "int",
        known: [spell],
        slots: {},
      },
    } as CharacterData;

    const catalog = {
      name: "Fire Bolt",
      level: 0,
      school: "Evocation",
      castingTime: "1 action",
      range: "120 feet",
      components: "V, S",
      duration: "Instantaneous",
      description: "You hurl a mote of fire at a creature or object within range.",
      ritual: false,
      concentration: false,
      classes: ["wizard"],
    };

    const tooltip = formatSpellPickerCombatTooltip(
      {
        spell,
        slug: "fire-bolt",
        castingCost: "action",
        catalog,
      },
      character
    );

    const descriptionIndex = tooltip.indexOf("You hurl a mote of fire");
    const toHitIndex = tooltip.indexOf("To hit:");
    assert.ok(toHitIndex >= 0, "expected To hit line");
    assert.ok(descriptionIndex > toHitIndex, "description should follow attack metadata");
  });
});
