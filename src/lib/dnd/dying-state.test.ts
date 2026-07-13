import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyDamageAtZeroHp,
  applyDeathFromSavingThrows,
  applyKnockToZeroHp,
  applyStabilize,
  applyWakeFromZeroHp,
  DEAD_CONDITION_SLUG,
  DYING_CONDITION_SLUG,
  ensureZeroHpDownedConditions,
  hasDyingCondition,
  isCharacterDead,
  needsDeathSavingThrow,
  syncCombatAfterHpChange,
  syncDeathSavesAfterDeadRemoved,
  syncDownedConditionsAfterHpChange,
} from "./dying-state.ts";
import { syncCombatDerivedStats } from "@/lib/character/combat-derivation.ts";
import type { CharacterData } from "@/lib/schemas/character";

function baseCombat(
  overrides: Partial<CharacterData["combat"]> = {}
): CharacterData["combat"] {
  return {
    ac: 10,
    maxHp: 20,
    currentHp: 10,
    tempHp: 0,
    initiativeBonus: 0,
    speed: 30,
    hitDice: "1d10",
    levelUpHpGains: [],
    hpGainsDieOnly: true,
    hitDiceSpent: 0,
    deathSaves: { successes: 0, failures: 0 },
    conditions: [],
    exhaustion: 0,
    concentration: { active: false, spell: "" },
    ...overrides,
  };
}

describe("dying-state", () => {
  it("applyKnockToZeroHp adds dying and auto conditions and resets saves", () => {
    const result = applyKnockToZeroHp(baseCombat({ currentHp: 5 }));
    assert.equal(result.currentHp, 0);
    assert.ok(result.conditions?.includes(DYING_CONDITION_SLUG));
    assert.ok(result.conditions?.includes("unconscious"));
    assert.ok(result.conditions?.includes("incapacitated"));
    assert.ok(result.conditions?.includes("prone"));
    assert.deepEqual(result.deathSaves, { successes: 0, failures: 0 });
  });

  it("needsDeathSavingThrow requires 0 HP and dying", () => {
    assert.equal(needsDeathSavingThrow(baseCombat({ currentHp: 0, conditions: [DYING_CONDITION_SLUG] })), true);
    assert.equal(needsDeathSavingThrow(baseCombat({ currentHp: 0, conditions: [] })), false);
    assert.equal(needsDeathSavingThrow(baseCombat({ currentHp: 1, conditions: [DYING_CONDITION_SLUG] })), false);
  });

  it("needsDeathSavingThrow is false when dead", () => {
    assert.equal(
      needsDeathSavingThrow(
        baseCombat({
          currentHp: 0,
          conditions: [DEAD_CONDITION_SLUG, "unconscious"],
          deathSaves: { successes: 0, failures: 3 },
        })
      ),
      false
    );
  });

  it("applyDeathFromSavingThrows removes dying and adds dead", () => {
    const result = applyDeathFromSavingThrows(
      baseCombat({
        currentHp: 0,
        conditions: [DYING_CONDITION_SLUG, "unconscious", "prone"],
        deathSaves: { successes: 1, failures: 3 },
      })
    );
    assert.equal(isCharacterDead(result), true);
    assert.equal(hasDyingCondition(result), false);
    assert.equal(result.deathSaves.failures, 3);
  });

  it("syncDeathSavesAfterDeadRemoved resets saves when dead is cleared", () => {
    const previous = baseCombat({
      currentHp: 0,
      conditions: [DEAD_CONDITION_SLUG, "unconscious"],
      deathSaves: { successes: 0, failures: 3 },
    });
    const next = syncDeathSavesAfterDeadRemoved(previous, {
      ...previous,
      conditions: ["unconscious"],
    });
    assert.deepEqual(next.deathSaves, { successes: 0, failures: 0 });
  });

  it("applyStabilize removes dying and resets saves", () => {
    const result = applyStabilize(
      baseCombat({
        currentHp: 0,
        conditions: [DYING_CONDITION_SLUG, "unconscious", "prone"],
        deathSaves: { successes: 2, failures: 1 },
      })
    );
    assert.equal(hasDyingCondition(result), false);
    assert.ok(result.conditions?.includes("unconscious"));
    assert.deepEqual(result.deathSaves, { successes: 0, failures: 0 });
  });

  it("applyWakeFromZeroHp removes unconscious and incapacitated but keeps prone", () => {
    const result = applyWakeFromZeroHp(
      baseCombat({
        currentHp: 0,
        conditions: [DYING_CONDITION_SLUG, "unconscious", "incapacitated", "prone", "poisoned"],
        deathSaves: { successes: 1, failures: 2 },
      }),
      5
    );
    assert.equal(result.currentHp, 5);
    assert.deepEqual(result.conditions, ["prone", "poisoned"]);
    assert.deepEqual(result.deathSaves, { successes: 0, failures: 0 });
  });

  it("applyDamageAtZeroHp at 3 failures applies dead state", () => {
    const stable = baseCombat({
      currentHp: 0,
      conditions: ["unconscious", "prone"],
      deathSaves: { successes: 0, failures: 1 },
    });
    const result = applyDamageAtZeroHp(stable, { isCritical: true });
    assert.equal(isCharacterDead(result), true);
    assert.equal(hasDyingCondition(result), false);
    assert.equal(result.deathSaves.failures, 3);
  });

  it("syncCombatAfterHpChange knocks down on transition to 0", () => {
    const combat = baseCombat({ currentHp: 10 });
    const result = syncCombatAfterHpChange(combat, 0, { previousHp: 10, damageToHp: 10 });
    assert.ok(hasDyingCondition(result));
  });

  it("syncCombatAfterHpChange wakes on heal above 0 but keeps prone", () => {
    const combat = baseCombat({
      currentHp: 0,
      conditions: [DYING_CONDITION_SLUG, "unconscious", "incapacitated", "prone"],
      deathSaves: { successes: 0, failures: 2 },
    });
    const result = syncCombatAfterHpChange(combat, 3, { previousHp: 0 });
    assert.equal(result.currentHp, 3);
    assert.deepEqual(result.conditions, ["prone"]);
    assert.deepEqual(result.deathSaves, { successes: 0, failures: 0 });
  });

  it("syncCombatAfterHpChange applies damage failures at 0 HP", () => {
    const combat = baseCombat({
      currentHp: 0,
      conditions: [DYING_CONDITION_SLUG],
      deathSaves: { successes: 0, failures: 0 },
    });
    const result = syncCombatAfterHpChange(combat, 0, {
      previousHp: 0,
      damageToHp: 5,
      isCritical: false,
    });
    assert.equal(result.deathSaves.failures, 1);
  });

  it("ensureZeroHpDownedConditions adds downed slugs without dying", () => {
    const result = ensureZeroHpDownedConditions(["poisoned"]);
    assert.ok(result.includes("unconscious"));
    assert.ok(result.includes("incapacitated"));
    assert.ok(result.includes("prone"));
    assert.ok(result.includes("poisoned"));
    assert.equal(result.includes(DYING_CONDITION_SLUG), false);
  });

  it("syncDownedConditionsAfterHpChange knocks down and wakes", () => {
    const knocked = syncDownedConditionsAfterHpChange(10, 0, []);
    assert.ok(knocked.includes("unconscious"));
    assert.ok(knocked.includes("incapacitated"));
    assert.ok(knocked.includes("prone"));

    const woke = syncDownedConditionsAfterHpChange(0, 5, knocked);
    assert.deepEqual(woke, ["prone"]);
  });

  it("syncCombatAfterHpChange enforces downed conditions when already at 0 HP", () => {
    const combat = baseCombat({ currentHp: 0, conditions: [] });
    const result = syncCombatAfterHpChange(combat, 0, { previousHp: 0 });
    assert.ok(result.conditions?.includes("unconscious"));
    assert.ok(result.conditions?.includes("incapacitated"));
    assert.ok(result.conditions?.includes("prone"));
  });

  it("syncCombatDerivedStats preserves dead condition at 0 HP", () => {
    const data = {
      basicInfo: {
        name: "Test",
        playerName: "",
        level: 1,
        xp: 0,
        classes: ["fighter"],
        subclass: "",
        class: "Fighter",
        species: "Human",
        background: "",
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
      combat: baseCombat({
        currentHp: 0,
        conditions: [DEAD_CONDITION_SLUG, "unconscious"],
        deathSaves: { successes: 0, failures: 3 },
      }),
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
      },
      inspiration: 0,
    } as CharacterData;

    const synced = syncCombatDerivedStats(data);
    assert.ok(synced.combat.conditions?.includes(DEAD_CONDITION_SLUG));
    assert.equal(hasDyingCondition(synced.combat), false);
  });
});
