import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldSkipDmReviewForAttacker } from "@/lib/combat/attack-actions";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";

function enemyToken(): CombatToken {
  return {
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
}

function combatState(autoApproveDm: boolean): CombatState {
  return {
    gridWidth: 20,
    gridHeight: 20,
    tileFeet: 5,
    backgroundPath: null,
    blockedCells: [],
    tokens: [enemyToken()],
    excludedPartyCharacterIds: [],
    initiative: { status: "ready", results: {}, order: ["enemy-1"] },
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
    autoApproveDm,
  };
}

describe("shouldSkipDmReviewForAttacker", () => {
  const attacker = enemyToken();
  const charactersById = {};

  it("skips DM review when DM acts with autoApproveDm enabled", () => {
    assert.equal(
      shouldSkipDmReviewForAttacker("dm-user", true, attacker, charactersById, combatState(true)),
      true
    );
  });

  it("does not skip DM review when autoApproveDm is disabled", () => {
    assert.equal(
      shouldSkipDmReviewForAttacker("dm-user", true, attacker, charactersById, combatState(false)),
      false
    );
  });

  it("does not skip DM review for non-DM users", () => {
    assert.equal(
      shouldSkipDmReviewForAttacker("player-user", false, attacker, charactersById, combatState(true)),
      false
    );
  });
});
