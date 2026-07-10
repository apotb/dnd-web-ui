import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateLevel1MaxHpBreakdown,
  calculateMaxHpBreakdown,
  stripConFromLevelUpHpGains,
} from "./combat-derivation.ts";
import type { CharacterData } from "@/lib/schemas/character";

function minimalData(levelUpHpGains: number[]): CharacterData {
  return {
    basicInfo: {
      name: "T",
      playerName: "",
      level: 1 + levelUpHpGains.length,
      xp: 0,
      classes: ["fighter"],
      subclass: "",
      class: "Fighter",
      species: "Human",
      background: "",
      alignment: "",
      portrait: "",
    },
    abilityScores: { str: 10, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
    savingThrows: {},
    skills: {},
    languages: [],
    speciesLanguageChoices: [],
    backgroundLanguageChoices: [],
    toolProficiencies: [],
    weaponProficiencies: [],
    armorProficiencies: [],
    combat: {
      ac: 10,
      maxHp: 1,
      currentHp: 1,
      tempHp: 0,
      initiativeBonus: 0,
      speed: 30,
      hitDice: "1d10",
      levelUpHpGains,
      hpGainsDieOnly: true,
      hitDiceSpent: 0,
      deathSaves: { successes: 0, failures: 0 },
      conditions: [],
      exhaustion: 0,
      concentration: { active: false, spell: "" },
    },
    attacks: [],
    customActions: [],
    spells: { known: [], prepared: [], slots: {}, grantUses: {} },
    inventory: { items: [], currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 } },
    supplies: {
      daysWithoutFood: 0,
      waterGallonsToday: 0,
      lastFedDate: null,
      lastWateredDate: null,
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
      acolyteOfNatureSkill: "",
      knowledgeDomainLanguages: [],
      knowledgeDomainSkills: [],
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
    levelUpFeats: {},
    inspiration: 0,
  };
}

describe("cumulative max hp", () => {
  it("level 1 only without gains", () => {
    const data = minimalData([]);
    const level1 = calculateLevel1MaxHpBreakdown(data);
    const total = calculateMaxHpBreakdown(data);
    assert.equal(level1.total, 10);
    assert.equal(total.total, 11);
    const conSource = total.sources.find((s) => s.label === "Constitution");
    assert.equal(conSource?.value, 1);
  });

  it("adds level-up hp gains and CON × level", () => {
    const data = minimalData([5, 4]);
    const total = calculateMaxHpBreakdown(data);
    assert.equal(total.total, 10 + 3 + 5 + 4);
    const conSource = total.sources.find((s) => s.label === "Constitution");
    assert.equal(conSource?.value, 3);
    const levelUpSource = total.sources.find((s) => s.label === "Level-up");
    assert.equal(levelUpSource?.value, 9);
  });

  it("retroactively applies CON when score increases", () => {
    const data = minimalData([5, 4]);
    data.abilityScores.con = 14;
    const total = calculateMaxHpBreakdown(data);
    assert.equal(total.total, 10 + 6 + 5 + 4);
  });
});

describe("stripConFromLevelUpHpGains", () => {
  it("strips current CON mod from bundled legacy gains", () => {
    assert.deepEqual(stripConFromLevelUpHpGains([7, 6], 1), [6, 5]);
  });

  it("clamps die gains to minimum 1", () => {
    assert.deepEqual(stripConFromLevelUpHpGains([1], 3), [1]);
  });
});
