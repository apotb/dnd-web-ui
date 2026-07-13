import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeReachableDestinations,
  findReachableDestination,
  getStepMovementCostFt,
} from "@/lib/combat/movement";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";

function token(overrides: Partial<CombatToken> & Pick<CombatToken, "id">): CombatToken {
  return {
    kind: "party",
    name: overrides.id,
    label: overrides.id,
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
    ...overrides,
  };
}

function baseState(tokens: CombatToken[]): CombatState {
  return {
    gridWidth: 20,
    gridHeight: 20,
    tileFeet: 5,
    backgroundPath: null,
    blockedCells: [],
    tokens,
    excludedPartyCharacterIds: [],
    initiative: { status: "ready", results: {}, order: [] },
    turn: {
      active: true,
      index: 0,
      round: 1,
      movementUsedFeet: 0,
      dashUsed: false,
      actionUsed: false,
      bonusActionUsed: false,
      disengageUsed: false,
      freeObjectInteractionUsed: false,
      deathSaveRolled: false,
      actionUsedForTwoWeapon: false,
      twoWeaponFightingUsedOffHand: null,
      multiattackBranchIndex: null,
      multiattackRemaining: {},
    },
    pendingOpportunityAttacks: null,
    reactionUsedTokenIds: [],
    pendingAttacks: [],
    autoApprove: false,
    autoApproveDm: false,
    battleParticipantCharacterIds: [],
    excludedAllyIds: [],
    xpPool: 0,
    boardTitle: "Combat",
  };
}

describe("movement crawling", () => {
  const mover = token({ id: "mover", x: 5, y: 5 });
  const state = baseState([mover]);
  const baseOptions = {
    speedFt: 30,
    usedFeet: 0,
    dashUsed: false,
    actionUsed: false,
    allowDash: true,
  };

  it("charges 2× tileFeet per step when crawling", () => {
    assert.equal(getStepMovementCostFt(state), 5);
    assert.equal(getStepMovementCostFt(state, { crawling: true }), 10);
  });

  it("reaches fewer cells when crawling", () => {
    const normal = computeReachableDestinations(mover, state, baseOptions);
    const crawl = computeReachableDestinations(mover, state, {
      ...baseOptions,
      crawling: true,
    });

    const normalFar = findReachableDestination(normal, 11, 5);
    const crawlFar = findReachableDestination(crawl, 11, 5);

    assert.ok(normalFar);
    assert.equal(normalFar.costFeet, 30);
    assert.equal(crawlFar, null);
  });

  it("applies 2× cost to each crawl destination", () => {
    const crawl = computeReachableDestinations(mover, state, {
      ...baseOptions,
      crawling: true,
    });
    const adjacent = findReachableDestination(crawl, 6, 5);
    assert.ok(adjacent);
    assert.equal(adjacent.costFeet, 10);
  });

  it("does not expose dash zones while crawling", () => {
    const normal = computeReachableDestinations(mover, state, baseOptions);
    const crawl = computeReachableDestinations(mover, state, {
      ...baseOptions,
      crawling: true,
    });

    const normalDash = findReachableDestination(normal, 12, 5);
    assert.ok(normalDash);
    assert.equal(normalDash.zone, "dash");
    assert.equal(normalDash.costFeet, 35);

    assert.equal(findReachableDestination(crawl, 12, 5), null);
    assert.equal(
      crawl.some((dest) => dest.zone === "dash"),
      false
    );
  });
});
