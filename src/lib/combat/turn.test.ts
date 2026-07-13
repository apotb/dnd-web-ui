import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canAdvanceTurnWithDeathSave } from "./turn.ts";
import type { CharacterData } from "@/lib/schemas/character";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";

function dyingCombat(): CharacterData["combat"] {
  return {
    ac: 10,
    maxHp: 20,
    currentHp: 0,
    tempHp: 0,
    initiativeBonus: 0,
    speed: 30,
    hitDice: "1d10",
    levelUpHpGains: [],
    hpGainsDieOnly: true,
    hitDiceSpent: 0,
    deathSaves: { successes: 0, failures: 0 },
    conditions: ["dying", "unconscious", "incapacitated", "prone"],
    exhaustion: 0,
    concentration: { active: false, spell: "" },
  };
}

function partyToken(id = "token-1"): CombatToken {
  return {
    id,
    kind: "party",
    name: "Fighter",
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

function combatStateWithTurn(token: CombatToken, deathSaveRolled = false): CombatState {
  return {
    gridWidth: 20,
    gridHeight: 20,
    tileFeet: 5,
    backgroundPath: null,
    blockedCells: [],
    tokens: [token],
    excludedPartyCharacterIds: [],
    initiative: { status: "ready", results: {}, order: [token.id] },
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
      deathSaveRolled,
      multiattackBranchIndex: null,
      multiattackRemaining: {},
      multiattackTokenId: null,
    },
    pendingAttacks: [],
    pendingOpportunityAttacks: null,
    boardTitle: "Combat",
    savedEncounterId: null,
    autoApprove: false,
  };
}

describe("canAdvanceTurnWithDeathSave", () => {
  it("blocks ending turn when dying and death save not rolled", () => {
    const state = combatStateWithTurn(partyToken());
    assert.equal(canAdvanceTurnWithDeathSave(state, dyingCombat()), false);
  });

  it("allows ending turn after death save rolled", () => {
    const state = combatStateWithTurn(partyToken(), true);
    assert.equal(canAdvanceTurnWithDeathSave(state, dyingCombat()), true);
  });

  it("allows ending turn when stable at 0 HP", () => {
    const state = combatStateWithTurn(partyToken());
    const combat = dyingCombat();
    combat.conditions = ["unconscious", "incapacitated", "prone"];
    assert.equal(canAdvanceTurnWithDeathSave(state, combat), true);
  });

  it("allows ending turn for non-party tokens", () => {
    const enemy: CombatToken = {
      ...partyToken("enemy-1"),
      kind: "enemy",
      characterId: undefined,
      name: "Goblin",
      label: "G",
    };
    const state = combatStateWithTurn(enemy);
    assert.equal(canAdvanceTurnWithDeathSave(state, null), true);
  });
});
