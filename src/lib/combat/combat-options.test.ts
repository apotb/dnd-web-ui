import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ParsedCharacter } from "@/lib/character/utils";
import {
  COMBAT_CAST_SPELL_ACTION_ID,
  getCombatOptionGroupsForToken,
  isSpellcastingEntryOption,
} from "@/lib/combat/combat-options";
import { PHB_CLASSES } from "@/lib/dnd/phb/classes";
import { ALL_SPECIES } from "@/lib/dnd/phb/species";
import { SHELL_DEFENSE_ENTER_ACTION_ID } from "@/lib/combat/feature-effects";
import type { Spell } from "@/lib/schemas/character";
import { createDefaultCharacterData } from "@/lib/schemas/character";
import { listCombatCastableLeveledSpells } from "@/lib/dnd/combat-spells";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";

function spell(overrides: Partial<Spell> & Pick<Spell, "name" | "level">): Spell {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name,
    level: overrides.level,
    prepared: overrides.prepared ?? true,
    notes: overrides.notes ?? "",
    spellId: overrides.spellId,
    grantKey: overrides.grantKey,
  };
}

function clericWithManySpells(): ParsedCharacter {
  const known = [
    spell({ name: "Sacred Flame", level: 0, spellId: "sacred-flame" }),
    spell({ name: "Mage Hand", level: 0, spellId: "mage-hand" }),
    spell({ name: "Bless", level: 1, spellId: "bless" }),
    spell({ name: "Guiding Bolt", level: 1, spellId: "guiding-bolt" }),
    spell({ name: "Cure Wounds", level: 1, spellId: "cure-wounds" }),
    spell({ name: "Spiritual Weapon", level: 2, spellId: "spiritual-weapon" }),
  ];
  const data = createDefaultCharacterData({
    basicInfo: {
      name: "Cleric",
      level: 5,
      classes: ["Cleric"],
    },
    abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
    spells: {
      spellcastingAbility: "wis",
      slots: { "1": { max: 4, used: 0 }, "2": { max: 3, used: 0 }, "3": { max: 2, used: 0 } },
      grantUses: {},
      known,
      prepared: known,
    },
  });

  return {
    id: "char-1",
    campaign_id: "camp-1",
    name: "Cleric",
    data,
  } as ParsedCharacter;
}

function partyToken(): CombatToken {
  return {
    id: "token-1",
    kind: "party",
    name: "Cleric",
    label: "A",
    tooltip: "",
    portraitPath: null,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    placed: true,
    damageTaken: 0,
    hasCollision: false,
    isObject: false,
    itemPickup: false,
    pickupQuantity: 1,
    hidden: false,
    activeEffects: [],
    characterId: "char-1",
  };
}

function combatState(token: CombatToken): CombatState {
  const enemy: CombatToken = {
    id: "enemy-1",
    kind: "enemy",
    name: "Goblin",
    label: "B",
    tooltip: "",
    portraitPath: null,
    x: 5,
    y: 5,
    width: 1,
    height: 1,
    placed: true,
    damageTaken: 0,
    currentHp: 7,
    maxHp: 7,
    hasCollision: false,
    isObject: false,
    itemPickup: false,
    pickupQuantity: 1,
    hidden: false,
    activeEffects: [],
  };

  return {
    gridWidth: 20,
    gridHeight: 20,
    tileFeet: 5,
    backgroundPath: null,
    blockedCells: [],
    tokens: [token, enemy],
    excludedPartyCharacterIds: [],
    initiative: { status: "ready", results: {}, order: [token.id, enemy.id] },
    turn: {
      active: true,
      index: 0,
      round: 1,
      movementUsedFeet: 0,
      dashUsed: false,
      actionUsedForTwoWeapon: false,
      twoWeaponFightingUsedOffHand: null,
      actionUsed: false,
      bonusActionUsed: false,
      disengageUsed: false,
      freeObjectInteractionUsed: false,
    },
    pendingAttacks: [],
    pendingOpportunityAttacks: null,
    boardTitle: "Combat",
    savedEncounterId: null,
    autoApprove: false,
  };
}

describe("getCombatOptionGroupsForToken spellcasting entries", () => {
  it("shows one Cast a Spell action instead of per-leveled-spell buttons", () => {
    const character = clericWithManySpells();
    assert.ok(
      listCombatCastableLeveledSpells(character.data, { castingCost: "action" }).length >= 3
    );
    const token = partyToken();
    const state = combatState(token);

    const groups = getCombatOptionGroupsForToken(token, {
      character,
      enemyData: null,
      catalogItems: {},
      classCatalog: PHB_CLASSES,
      featureCatalogs: {},
      actionUsedForTwoWeapon: false,
      twoWeaponFightingUsedOffHand: null,
      actionUsed: false,
      bonusActionUsed: false,
      dashUsed: false,
      freeObjectInteractionUsed: false,
      combatState: state,
      token,
      canUseObject: true,
    });

    const spellCastButtons = groups.actions.filter(
      (option) => option.spellCast != null && (option.spellCast.level ?? 0) > 0
    );
    const castSpellEntries = groups.actions.filter(isSpellcastingEntryOption);
    const cantripAttacks = groups.actions.filter(
      (option) => option.attack?.source === "cantrip"
    );

    const utilityCantripButtons = groups.actions.filter(
      (option) => option.spellCast != null && option.spellCast.level === 0
    );
    assert.equal(spellCastButtons.length, 0);
    assert.equal(utilityCantripButtons.length, 0);
    assert.equal(castSpellEntries.length, 1);
    assert.equal(castSpellEntries[0]?.id, `action:${COMBAT_CAST_SPELL_ACTION_ID}`);
    assert.ok(cantripAttacks.length >= 1);

    const bonusCastSpellEntry = groups.bonusActions.filter(isSpellcastingEntryOption);
    const bonusLeveledSpells = groups.bonusActions.filter(
      (option) => option.spellCast != null && (option.spellCast.level ?? 0) > 0
    );
    assert.equal(bonusCastSpellEntry.length, 0);
    assert.ok(bonusLeveledSpells.some((option) => option.name === "Spiritual Weapon"));
  });

  it("lists feature actions before standard actions", () => {
    const data = createDefaultCharacterData({
      basicInfo: {
        name: "Tortle",
        level: 1,
        classes: ["Fighter"],
        species: "Tortle",
      },
    });
    const character = {
      id: "char-1",
      campaign_id: "camp-1",
      name: "Tortle",
      data,
    } as ParsedCharacter;
    const token = partyToken();
    const state = combatState(token);

    const groups = getCombatOptionGroupsForToken(token, {
      character,
      enemyData: null,
      catalogItems: {},
      classCatalog: PHB_CLASSES,
      featureCatalogs: { species: ALL_SPECIES },
      actionUsedForTwoWeapon: false,
      twoWeaponFightingUsedOffHand: null,
      actionUsed: false,
      bonusActionUsed: false,
      dashUsed: false,
      freeObjectInteractionUsed: false,
      combatState: state,
      token,
      canUseObject: true,
    });

    const featureIndex = groups.actions.findIndex(
      (option) => option.action?.id === SHELL_DEFENSE_ENTER_ACTION_ID
    );
    const standardIndex = groups.actions.findIndex(
      (option) => option.action?.source === "core" && option.action.cost === "action"
    );

    assert.ok(featureIndex >= 0);
    assert.ok(standardIndex >= 0);
    assert.ok(featureIndex < standardIndex);
  });
});
