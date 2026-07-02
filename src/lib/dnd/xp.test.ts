import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canLevelUp,
  getCharacterNextLevelUpTarget,
  getCommittedLevel,
  levelFromXp,
  xpForLevel,
  xpProgressForLevel,
} from "./xp.ts";
import type { CharacterData } from "@/lib/schemas/character";

function minimalCharacter(overrides: Partial<CharacterData> = {}): CharacterData {
  return {
    basicInfo: {
      name: "Test",
      playerName: "",
      level: 1,
      xp: 0,
      classes: ["fighter"],
      subclass: "",
      class: "Fighter",
      species: "Human",
      background: "Soldier",
      alignment: "",
      portrait: "",
    },
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
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
      maxHp: 10,
      currentHp: 10,
      tempHp: 0,
      initiativeBonus: 0,
      speed: 30,
      hitDice: "1d10",
      levelUpHpGains: [],
      hitDiceSpent: 0,
      deathSaves: { successes: 0, failures: 0 },
      conditions: [],
      exhaustion: 0,
      concentration: { active: false, spell: "" },
    },
    attacks: [],
    customActions: [],
    spells: {
      spellcastingAbility: undefined,
      known: [],
      prepared: [],
      slots: {},
      grantUses: {},
    },
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
    ...overrides,
  };
}

describe("xp gating", () => {
  it("canLevelUp when xp meets next threshold but committed level lags", () => {
    assert.equal(canLevelUp(1, 300), true);
    assert.equal(canLevelUp(1, 299), false);
    assert.equal(canLevelUp(1, 2700), true);
  });

  it("getNextLevelUpTarget is always committed + 1", () => {
    assert.equal(
      getCharacterNextLevelUpTarget(
        minimalCharacter({
          basicInfo: { ...minimalCharacter().basicInfo, level: 1, xp: 2700 },
        })
      ),
      2
    );
    assert.equal(
      getCharacterNextLevelUpTarget(
        minimalCharacter({
          basicInfo: { ...minimalCharacter().basicInfo, level: 3, xp: 2699 },
        })
      ),
      null
    );
  });

  it("xpProgressForLevel uses committed level not xp-derived level", () => {
    const progress = xpProgressForLevel(1, 1500);
    assert.equal(progress.level, 1);
    assert.equal(progress.nextLevelXp, xpForLevel(2));
    assert.equal(levelFromXp(1500), 3);
  });

  it("getCommittedLevel clamps to 1-20", () => {
    const data = minimalCharacter({
      basicInfo: { ...minimalCharacter().basicInfo, level: 0 },
    });
    assert.equal(getCommittedLevel(data), 1);
  });
});
