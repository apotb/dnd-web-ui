import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateLevel1MaxHpBreakdown,
  calculateMaxHpBreakdown,
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
    assert.equal(level1.total, 11);
    assert.equal(total.total, 11);
  });

  it("adds level-up hp gains", () => {
    const data = minimalData([7, 6]);
    const total = calculateMaxHpBreakdown(data);
    assert.equal(total.total, 11 + 7 + 6);
  });
});
