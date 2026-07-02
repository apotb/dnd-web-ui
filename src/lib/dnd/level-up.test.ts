import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAsiLevel } from "./asi-levels.ts";
import {
  averageHpGain,
  averageHitDieRoll,
  computeHpGain,
  getLevelUpSteps,
  getNewFeaturesAtLevel,
  validateLevelUpDraft,
  type LevelUpStep,
  type LevelUpStepKind,
} from "./level-up.ts";
import { canCharacterLevelUp, getCharacterLevel } from "./xp.ts";
import type { CharacterData } from "@/lib/schemas/character";
import { PHB_CLASSES } from "./phb/classes.ts";

function choiceStepKinds(steps: LevelUpStep[]): LevelUpStepKind[] {
  return steps
    .filter((s) => s.kind !== "review" && s.kind !== "subclass")
    .map((s) => s.kind);
}

function assertStepsMatchReviewOrder(steps: LevelUpStep[]): void {
  const review = steps.find((s) => s.kind === "review");
  assert.ok(review && review.kind === "review");
  const kinds = choiceStepKinds(steps);
  const interactiveNames = review.features
    .filter((f) => f.source === "other")
    .map((f) => f.name);

  assert.equal(kinds.length, interactiveNames.length);

  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[i];
    const name = interactiveNames[i];
    const matches =
      (kind === "fightingStyle" && name === "Fighting Style") ||
      (kind === "hp" && name === "Hit Points") ||
      (kind === "prepareSpells" && name.includes("prepared spell")) ||
      (kind === "cantrips" && name.includes("cantrip")) ||
      (kind === "spellsKnown" && name.includes("known")) ||
      (kind === "wizardSpellbook" && name.includes("spellbook")) ||
      (kind === "rangerPicks" && name === "Ranger choices") ||
      (kind === "subclassChoices" && name === "Subclass choices") ||
      (kind === "asiOrFeat" && name === "Ability Score Improvement");
    assert.ok(matches, `step ${i}: ${kind} does not match review "${name}"`);
  }
}

function fighterAtLevel1(xp = 0): CharacterData {
  return {
    basicInfo: {
      name: "Bruenor",
      playerName: "",
      level: 1,
      xp,
      classes: ["fighter"],
      class: "Fighter",
      subclass: "",
      species: "Dwarf",
      background: "Soldier",
      alignment: "LG",
      portrait: "",
    },
    abilityScores: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 8 },
    savingThrows: {},
    skills: {},
    languages: [],
    speciesLanguageChoices: [],
    backgroundLanguageChoices: [],
    toolProficiencies: [],
    weaponProficiencies: [],
    armorProficiencies: [],
    combat: {
      ac: 16,
      maxHp: 12,
      currentHp: 12,
      tempHp: 0,
      initiativeBonus: 0,
      speed: 25,
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
      fightingStyle: "Defense",
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

describe("asi levels", () => {
  it("fighter gets extra ASI levels", () => {
    assert.equal(isAsiLevel("fighter", 6), true);
    assert.equal(isAsiLevel("fighter", 5), false);
    assert.equal(isAsiLevel("rogue", 10), true);
    assert.equal(isAsiLevel("wizard", 10), false);
  });
});

describe("level-up steps", () => {
  const catalogs = { classes: PHB_CLASSES };

  it("level 2 fighter includes review and hp", () => {
    const data = fighterAtLevel1(300);
    const steps = getLevelUpSteps(data, catalogs, 2);
    assert.ok(steps.some((s) => s.kind === "review"));
    assert.ok(steps.some((s) => s.kind === "hp"));
    assert.equal(steps.some((s) => s.kind === "subclass"), false);
  });

  it("level 3 fighter requires review before subclass", () => {
    const data = { ...fighterAtLevel1(900), basicInfo: { ...fighterAtLevel1().basicInfo, level: 2, xp: 900 } };
    const steps = getLevelUpSteps(data, catalogs, 3);
    const subclassIdx = steps.findIndex((s) => s.kind === "subclass");
    const reviewIdx = steps.findIndex((s) => s.kind === "review");
    assert.ok(subclassIdx >= 0);
    assert.ok(reviewIdx < subclassIdx);
  });

  it("level 3 fighter review shows subclass features after draft pick", () => {
    const data = { ...fighterAtLevel1(900), basicInfo: { ...fighterAtLevel1().basicInfo, level: 2, xp: 900 } };
    const champion = PHB_CLASSES.find((c) => c.id === "fighter")?.subclasses.find((s) => s.id === "champion");
    assert.ok(champion);
    const features = getNewFeaturesAtLevel(data, catalogs, 3, {
      subclassId: champion!.id,
      subclassName: champion!.name,
    });
    const names = features.map((f) => f.name);
    assert.ok(names.includes("Improved Critical"));
  });

  it("fighter level 2 shows Action Surge", () => {
    const data = fighterAtLevel1(300);
    const features = getNewFeaturesAtLevel(data, catalogs, 2);
    assert.ok(features.some((f) => f.name.includes("Action Surge")));
  });

  it("level 2 barbarian shows Reckless Attack and Danger Sense", () => {
    const data = fighterAtLevel1(300);
    data.basicInfo.classes = ["Barbarian"];
    data.basicInfo.class = "Barbarian";
    const features = getNewFeaturesAtLevel(data, { classes: PHB_CLASSES }, 2);
    const names = features.map((f) => f.name);
    assert.ok(names.includes("Reckless Attack"));
    assert.ok(names.includes("Danger Sense"));
  });

  it("validates hp draft", () => {
    const data = fighterAtLevel1(300);
    const err = validateLevelUpDraft(data, catalogs, 2, {});
    assert.match(err ?? "", /hit points/i);
    const ok = validateLevelUpDraft(data, catalogs, 2, {
      hp: { method: "average", gain: 8 },
    });
    assert.equal(ok, null);
  });

  it("validates asi draft requires style", () => {
    const data = fighterAtLevel1(6500);
    const err = validateLevelUpDraft(data, catalogs, 4, {
      hp: { method: "average", gain: 8 },
      asiOrFeat: { mode: "asi" },
    });
    assert.match(err ?? "", /ability score improvement/i);
    const ok = validateLevelUpDraft(data, catalogs, 4, {
      hp: { method: "average", gain: 8 },
      asiOrFeat: { mode: "asi", style: "double", doubleAbility: "str" },
    });
    assert.equal(ok, null);
  });
});

describe("hp gain", () => {
  it("averageHitDieRoll rounds mean down", () => {
    assert.equal(averageHitDieRoll(12), 6);
    assert.equal(averageHitDieRoll(10), 5);
  });

  it("averageHpGain adds CON to rounded-down die average", () => {
    assert.equal(averageHpGain(10, 2), 7);
  });

  it("computeHpGain roll adds con mod", () => {
    assert.equal(computeHpGain(10, 2, "roll", 7), 9);
  });
});

describe("one level at a time", () => {
  it("committed level stays 1 until level up despite high xp", () => {
    const data = fighterAtLevel1(2700);
    assert.equal(getCharacterLevel(data), 1);
    assert.equal(canCharacterLevelUp(data), true);
  });
});

function characterAtLevel1(
  classId: string,
  className: string,
  xp = 300,
  overrides: Partial<CharacterData> = {}
): CharacterData {
  const base = fighterAtLevel1(xp);
  return {
    ...base,
    ...overrides,
    basicInfo: {
      ...base.basicInfo,
      ...overrides.basicInfo,
      classes: [className],
      class: className,
      subclass: overrides.basicInfo?.subclass ?? "",
      xp,
    },
    featureChoices: {
      ...base.featureChoices,
      ...overrides.featureChoices,
      fightingStyle: overrides.featureChoices?.fightingStyle ?? "",
    },
    abilityScores: {
      ...base.abilityScores,
      ...overrides.abilityScores,
    },
    spells: overrides.spells ?? base.spells,
  };
}

describe("paladin level 1 to 2", () => {
  const catalogs = { classes: PHB_CLASSES };

  it("includes fighting style, prepare spells, and hp steps", () => {
    const data = characterAtLevel1("paladin", "Paladin", 300, {
      abilityScores: { str: 16, dex: 10, con: 14, int: 10, wis: 10, cha: 14 },
      featureChoices: { fightingStyle: "" },
    });
    const steps = getLevelUpSteps(data, catalogs, 2);
    assert.ok(steps.some((s) => s.kind === "fightingStyle"));
    const prepare = steps.find((s) => s.kind === "prepareSpells");
    assert.ok(prepare && prepare.kind === "prepareSpells");
    assert.equal(prepare.count, 3);
    assert.ok(steps.some((s) => s.kind === "hp"));
    const review = steps.find((s) => s.kind === "review");
    assert.ok(review && review.kind === "review");
    assert.ok(review.features.some((f) => f.name.includes("Divine Smite")));
    assertStepsMatchReviewOrder(steps);
    assert.deepEqual(choiceStepKinds(steps), [
      "fightingStyle",
      "prepareSpells",
      "hp",
    ]);
    const fsIdx = review.features.findIndex((f) => f.name === "Fighting Style");
    const scIdx = review.features.findIndex((f) => f.name === "Spellcasting");
    assert.ok(fsIdx >= 0 && scIdx >= 0 && fsIdx < scIdx);
  });
});

describe("cleric level 1 to 2", () => {
  const catalogs = { classes: PHB_CLASSES };

  it("includes prepare spells step when prepare limit increases", () => {
    const data = characterAtLevel1("cleric", "Cleric", 300, {
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 },
    });
    const steps = getLevelUpSteps(data, catalogs, 2);
    const prepare = steps.find((s) => s.kind === "prepareSpells");
    assert.ok(prepare && prepare.kind === "prepareSpells");
    assert.equal(prepare.count, 1);
    const review = steps.find((s) => s.kind === "review");
    assert.ok(review && review.kind === "review");
    assert.ok(review.features.some((f) => f.name.includes("Channel Divinity")));
    assertStepsMatchReviewOrder(steps);
  });
});

describe("wizard level 1 to 2", () => {
  const catalogs = { classes: PHB_CLASSES };

  it("requires subclass, spellbook picks, and shows Arcane Recovery", () => {
    const data = characterAtLevel1("wizard", "Wizard", 300);
    const steps = getLevelUpSteps(data, catalogs, 2);
    const subclass = steps.find((s) => s.kind === "subclass");
    assert.ok(subclass && subclass.kind === "subclass");
    const evocation = subclass.options.find((o) => o.value === "evocation");
    assert.ok(evocation);
    assert.equal(evocation.label, "Evocation");
    assert.match(evocation.description ?? "", /Sculpt Spells/i);
    const spellbook = steps.find((s) => s.kind === "wizardSpellbook");
    assert.ok(spellbook && spellbook.kind === "wizardSpellbook");
    assert.equal(spellbook.count, 2);
    const review = steps.find((s) => s.kind === "review");
    assert.ok(review && review.kind === "review");
    assert.ok(review.features.some((f) => f.name === "Arcane Recovery"));
    assertStepsMatchReviewOrder(steps);
    assert.deepEqual(choiceStepKinds(steps), ["wizardSpellbook", "hp"]);
    const arIdx = review.features.findIndex((f) => f.name === "Arcane Recovery");
    const sbIdx = review.features.findIndex((f) => f.name.includes("spellbook"));
    const hpIdx = review.features.findIndex((f) => f.name === "Hit Points");
    assert.ok(arIdx >= 0 && sbIdx >= 0 && hpIdx >= 0);
    assert.ok(arIdx < sbIdx && sbIdx < hpIdx);
  });
});

describe("ranger level 1 to 2", () => {
  const catalogs = { classes: PHB_CLASSES };

  it("includes fighting style and spells known steps when unset", () => {
    const data = characterAtLevel1("ranger", "Ranger", 300, {
      abilityScores: { str: 10, dex: 14, con: 12, int: 10, wis: 14, cha: 10 },
      featureChoices: { fightingStyle: "" },
    });
    const steps = getLevelUpSteps(data, catalogs, 2);
    assert.ok(steps.some((s) => s.kind === "fightingStyle"));
    const spellsKnown = steps.find((s) => s.kind === "spellsKnown");
    assert.ok(spellsKnown && spellsKnown.kind === "spellsKnown");
    assert.equal(spellsKnown.count, 2);
    assert.ok(steps.some((s) => s.kind === "hp"));
    assertStepsMatchReviewOrder(steps);
  });
});
