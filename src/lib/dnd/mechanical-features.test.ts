import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyLayOnHands,
  applyLayOnHandsCure,
  applyLayOnHandsHeal,
  applySecondWind,
  applySpellSlotRecovery,
  ARCANE_RECOVERY_ID,
  canLayOnHandsHealTarget,
  canUseSecondWind,
  getLayOnHandsPoolRemaining,
  getMechanicalFeatureCurrent,
  getSpellRecoveryBudget,
  getSpellRecoveryOptions,
  LAY_ON_HANDS_ID,
  mechanicalFeatureQualifies,
  NATURAL_RECOVERY_ID,
  resetMechanicalFeatureUses,
  SECOND_WIND_ID,
  spendLayOnHandsPool,
  validateSpellRecoverySelections,
} from "@/lib/dnd/mechanical-features";
import type { CharacterData } from "@/lib/schemas/character";

function wizardData(overrides: Partial<CharacterData> = {}): CharacterData {
  return {
    basicInfo: {
      name: "Gandalf",
      playerName: "",
      level: 5,
      xp: 6500,
      classes: ["Wizard"],
      subclass: "",
      species: "",
      background: "",
      alignment: "",
      portrait: "",
      publicNotes: "",
      dmNotes: "",
    },
    abilityScores: {
      str: 10,
      dex: 10,
      con: 10,
      int: 16,
      wis: 10,
      cha: 10,
    },
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
      currentHp: 10,
      tempHp: 0,
      initiativeBonus: 0,
      speed: 30,
      hitDice: "5d6",
      hitDiceSpent: 0,
      lastLongRestDate: null,
      deathSaves: { successes: 0, failures: 0 },
      conditions: [],
      exhaustion: 0,
      concentration: { active: false, spell: "" },
      pendingInitiativeRoll: null,
      pendingShortRest: true,
    },
    attacks: [],
    customActions: [],
    spells: {
      spellcastingHidden: false,
      spellcastingAbility: "int",
      grantUses: {},
      slots: {
        "1": { max: 4, used: 2 },
        "2": { max: 3, used: 2 },
        "3": { max: 2, used: 1 },
      },
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

describe("mechanical-features", () => {
  it("computes spell recovery budget as half level rounded up", () => {
    assert.equal(getSpellRecoveryBudget(1), 1);
    assert.equal(getSpellRecoveryBudget(5), 3);
    assert.equal(getSpellRecoveryBudget(6), 3);
    assert.equal(getSpellRecoveryBudget(7), 4);
  });

  it("lists recoverable wizard slots excluding 6th+ levels", () => {
    const data = wizardData({
      spells: {
        spellcastingHidden: false,
        grantUses: {},
        slots: {
          "1": { max: 4, used: 1 },
          "6": { max: 1, used: 1 },
        },
        known: [],
        prepared: [],
      },
    });
    const options = getSpellRecoveryOptions(data, ARCANE_RECOVERY_ID);
    assert.ok(options);
    assert.equal(options!.budget, 3);
    assert.equal(options!.levels.length, 1);
    assert.equal(options!.levels[0]?.level, 1);
    assert.equal(options!.available, true);
  });

  it("rejects spell recovery over budget", () => {
    const data = wizardData();
    const result = validateSpellRecoverySelections(data, ARCANE_RECOVERY_ID, [
      { level: 2, count: 2 },
    ]);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.reason, /exceed recovery budget/i);
    }
  });

  it("rejects recovering more slots than used", () => {
    const data = wizardData();
    const result = validateSpellRecoverySelections(data, ARCANE_RECOVERY_ID, [
      { level: 1, count: 3 },
    ]);
    assert.equal(result.ok, false);
  });

  it("applies spell slot recovery and spends the feature use", () => {
    const data = wizardData();
    const next = applySpellSlotRecovery(data, ARCANE_RECOVERY_ID, [
      { level: 1, count: 1 },
      { level: 2, count: 1 },
    ]);
    assert.equal(next.spells.slots["1"]?.used, 1);
    assert.equal(next.spells.slots["2"]?.used, 1);
    assert.equal(
      getMechanicalFeatureCurrent(next, ARCANE_RECOVERY_ID),
      0
    );
  });

  it("natural recovery blocks slots above 5th level", () => {
    const data = wizardData({
      basicInfo: {
        ...wizardData().basicInfo,
        classes: ["Druid"],
        subclass: "Circle of the Land",
      },
      spells: {
        spellcastingHidden: false,
        grantUses: {},
        slots: {
          "5": { max: 2, used: 1 },
          "6": { max: 1, used: 1 },
        },
        known: [],
        prepared: [],
      },
    });
    const options = getSpellRecoveryOptions(data, NATURAL_RECOVERY_ID);
    assert.ok(options);
    assert.equal(options!.levels.length, 1);
    assert.equal(options!.levels[0]?.level, 5);
  });

  it("resets second wind on short rest and arcane recovery on long rest", () => {
    const wizardUsed = wizardData({
      featureUseState: { [ARCANE_RECOVERY_ID]: { current: 0 } },
    });
    const fighterUsed = wizardData({
      featureUseState: { [SECOND_WIND_ID]: { current: 0 } },
      basicInfo: {
        ...wizardData().basicInfo,
        classes: ["Fighter"],
      },
      combat: {
        ...wizardData().combat,
        hitDice: "5d10",
      },
    });

    const wizardAfterShort = resetMechanicalFeatureUses(wizardUsed, "short");
    assert.equal(
      getMechanicalFeatureCurrent(wizardAfterShort, ARCANE_RECOVERY_ID),
      0
    );

    const fighterAfterShort = resetMechanicalFeatureUses(fighterUsed, "short");
    assert.equal(
      getMechanicalFeatureCurrent(fighterAfterShort, SECOND_WIND_ID),
      1
    );

    const wizardAfterLong = resetMechanicalFeatureUses(wizardUsed, "long");
    assert.equal(
      getMechanicalFeatureCurrent(wizardAfterLong, ARCANE_RECOVERY_ID),
      1
    );
  });

  it("returns zero uses for non-qualifying characters", () => {
    const wizard = wizardData();
    assert.equal(getMechanicalFeatureCurrent(wizard, SECOND_WIND_ID), 0);
    assert.equal(canUseSecondWind(wizard), false);
  });

  it("blocks second wind at full hp", () => {
    const fighter = wizardData({
      basicInfo: {
        ...wizardData().basicInfo,
        classes: ["Fighter"],
      },
      combat: {
        ...wizardData().combat,
        maxHp: 50,
        currentHp: 50,
      },
    });
    assert.equal(canUseSecondWind(fighter), false);
  });

  it("second wind heals hp up to stored max hp", () => {
    const data = wizardData({
      basicInfo: {
        ...wizardData().basicInfo,
        classes: ["Fighter"],
        xp: 6500,
      },
      combat: {
        ...wizardData().combat,
        hitDice: "5d10",
        maxHp: 50,
        currentHp: 10,
      },
    });
    const next = applySecondWind(data, 10);
    assert.equal(next.combat.currentHp, 25);
    assert.equal(getMechanicalFeatureCurrent(next, SECOND_WIND_ID), 0);
  });

  it("spends lay on hands pool up to remaining amount", () => {
    const paladin = wizardData({
      basicInfo: { ...wizardData().basicInfo, classes: ["Paladin"], xp: 6500 },
      featureUseState: { [LAY_ON_HANDS_ID]: { current: 8 } },
    });
    const spent = spendLayOnHandsPool(paladin, 12);
    assert.equal(getLayOnHandsPoolRemaining(spent), 0);
    const partial = spendLayOnHandsPool(paladin, 3);
    assert.equal(getLayOnHandsPoolRemaining(partial), 5);
  });

  it("lay on hands heal clamps to pool and target max hp", () => {
    const paladin = wizardData({
      basicInfo: { ...wizardData().basicInfo, classes: ["Paladin"], xp: 6500 },
      featureUseState: { [LAY_ON_HANDS_ID]: { current: 10 } },
    });
    const ally = wizardData({
      combat: { ...wizardData().combat, maxHp: 30, currentHp: 25 },
    });
    const result = applyLayOnHandsHeal(paladin, ally, 20);
    assert.ok(result);
    assert.equal(result!.healed, 5);
    assert.equal(result!.targetData.combat.currentHp, 30);
    assert.equal(getLayOnHandsPoolRemaining(result!.paladinData), 5);
  });

  it("lay on hands cure spends five pool and removes poisoned", () => {
    const paladin = wizardData({
      basicInfo: { ...wizardData().basicInfo, classes: ["Paladin"], xp: 6500 },
      featureUseState: { [LAY_ON_HANDS_ID]: { current: 10 } },
    });
    const ally = wizardData({
      combat: {
        ...wizardData().combat,
        conditions: ["poisoned"],
      },
    });
    const result = applyLayOnHandsCure(paladin, ally);
    assert.ok(result);
    assert.equal(getLayOnHandsPoolRemaining(result!.paladinData), 5);
    assert.equal(result!.targetData.combat.conditions?.length ?? 0, 0);
  });

  it("rejects lay on hands for non-paladins", () => {
    const wizard = wizardData({
      featureUseState: { [LAY_ON_HANDS_ID]: { current: 10 } },
    });
    assert.equal(mechanicalFeatureQualifies(wizard, LAY_ON_HANDS_ID), false);
    assert.equal(getLayOnHandsPoolRemaining(wizard), 0);
    const spent = spendLayOnHandsPool(wizard, 5);
    assert.equal(spent, wizard);
  });

  it("cannot lay on hands heal a target at full hp", () => {
    const target = wizardData({
      combat: { ...wizardData().combat, maxHp: 30, currentHp: 30 },
    });
    assert.equal(canLayOnHandsHealTarget(target, 5), false);
    const paladin = wizardData({
      basicInfo: { ...wizardData().basicInfo, classes: ["Paladin"], xp: 6500 },
      featureUseState: { [LAY_ON_HANDS_ID]: { current: 10 } },
    });
    assert.equal(applyLayOnHands(paladin, target, "heal", 5), null);
  });
});
