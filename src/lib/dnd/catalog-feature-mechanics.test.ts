import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  catalogFeatureId,
  evaluateMaxFormula,
  evaluateUsesMax,
  parseCatalogFeatureMechanics,
  resolveMechanicsFromCatalog,
} from "@/lib/dnd/catalog-feature-mechanics";
import type { CharacterData } from "@/lib/schemas/character";

function baseData(overrides: Partial<CharacterData> = {}): CharacterData {
  return {
    basicInfo: {
      name: "Test",
      playerName: "",
      level: 5,
      xp: 6500,
      classes: ["Barbarian"],
      subclass: "",
      species: "",
      background: "",
      alignment: "",
      portrait: "",
      publicNotes: "",
      dmNotes: "",
    },
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 14 },
    inspiration: 0,
    savingThrows: {},
    skills: {},
    languages: [],
    speciesLanguageChoices: [],
    backgroundLanguageChoices: [],
    toolProficiencies: [],
    weaponProficiencies: [],
    armorProficiencies: [],
    combat: {
      ac: 12,
      maxHp: 30,
      currentHp: 30,
      tempHp: 0,
      initiativeBonus: 0,
      speed: 30,
      hitDice: "5d12",
      hitDiceSpent: 0,
      lastLongRestDate: null,
      deathSaves: { successes: 0, failures: 0 },
      conditions: [],
      exhaustion: 0,
      concentration: { active: false, spell: "" },
      pendingInitiativeRoll: null,
      pendingShortRest: false,
    },
    attacks: [],
    customActions: [],
    spells: {
      spellcastingHidden: false,
      grantUses: {},
      slots: {},
      known: [],
      prepared: [],
    },
    inventory: {
      currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
      items: [],
      notes: "",
    },
    supplies: {
      fedDate: null,
      wateredDate: null,
      daysWithoutFood: 0,
      waterGallonsToday: 0,
      pendingDehydrationSave: null,
    },
    exhaustionLevels: [],
    featureChoices: {
      fightingStyle: "",
      favoredEnemy: "",
      favoredHumanoidSpecies: [],
      favoredTerrain: "",
      variantHumanFeat: "",
      magicInitiateClass: "",
      magicInitiateCantripIds: [],
      magicInitiateSpellId: "",
      bonusDruidCantripId: "",
    },
    speciesChoices: {
      halfElfAbilityBonuses: [],
      speciesSkillChoices: [],
      speciesWeaponChoices: [],
      speciesToolChoice: "",
      speciesSkillOrTool: "",
      variantHumanAbilityBonuses: [],
      variantHumanSkill: "",
      speciesCantripId: "",
    },
    backgroundChoices: {
      backgroundSkillChoices: [],
      backgroundToolPick: "",
      backgroundToolMulti: [],
      backgroundArtisanTool: "",
      backgroundGamingSet: "",
      backgroundMusicalInstrument: "",
      backgroundExplorerTool: "",
    },
    classSkillChoices: [],
    features: [],
    featureUseState: {},
    ...overrides,
  };
}

describe("catalog-feature-mechanics", () => {
  it("builds stable ids from slug when provided", () => {
    assert.equal(
      catalogFeatureId("class", { name: "Battle Cry", slug: "battle-cry" }),
      "granted:class:battle-cry"
    );
  });

  it("parses uses mechanics from catalog JSON", () => {
    const parsed = parseCatalogFeatureMechanics({
      kind: "uses",
      max: 3,
      restReset: "long",
    });
    assert.ok(parsed);
    assert.equal(parsed!.kind, "uses");
    assert.equal(parsed!.max, 3);
  });

  it("evaluates preset max formulas", () => {
    const ctx = { level: 5, data: baseData() };
    assert.equal(evaluateMaxFormula("5 * level", ctx), 25);
    assert.equal(evaluateMaxFormula("level", ctx), 5);
    assert.equal(evaluateMaxFormula(10, ctx), 10);
    assert.equal(evaluateUsesMax("chaMod", ctx), 2);
  });

  it("resolves hp-pool mechanics with cure config", () => {
    const entry = {
      name: "Mercy Touch",
      description: "Touch heal from a pool.",
      slug: "mercy-touch",
      mechanics: {
        kind: "hp-pool" as const,
        restReset: "long" as const,
        maxFormula: "5 * level" as const,
        usesAction: true,
        actionCost: "action" as const,
        cure: { cost: 5, conditions: ["poisoned"] },
      },
    };
    const id = catalogFeatureId("class", entry);
    const resolved = resolveMechanicsFromCatalog(id, entry, entry.mechanics);
    assert.equal(resolved.kind, "hp-pool");
    assert.equal(resolved.maxValue({ level: 4, data: baseData() }), 20);
    assert.equal(resolved.hpPool?.cureCost, 5);
    assert.equal(resolved.usesAction, true);
  });
});
