import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  creditXpForDefeatedEnemies,
  distributeXpPool,
  previewXpDistribution,
} from "@/lib/combat/xp-pool";
import { getEnemyXpValue, xpFromChallengeRating } from "@/lib/dnd/enemy-xp";
import { createDefaultEnemyData } from "@/lib/schemas/enemy";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";

function enemyToken(overrides: Partial<CombatToken> = {}): CombatToken {
  return {
    id: "enemy-1",
    kind: "enemy",
    name: "Goblin",
    label: "A",
    tooltip: "",
    enemySlug: "goblin",
    portraitPath: null,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    placed: true,
    currentHp: 0,
    maxHp: 7,
    damageTaken: 7,
    hidden: true,
    hasCollision: false,
    isObject: false,
    itemPickup: false,
    pickupQuantity: 1,
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
    initiative: { status: "none", results: {}, order: [] },
    turn: {
      active: false,
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
    autoApproveDm: true,
    xpPool: 0,
    battleParticipantCharacterIds: [],
    reactionUsedTokenIds: [],
  };
}

describe("enemy-xp", () => {
  it("derives XP from challenge rating fractions and integers", () => {
    assert.equal(xpFromChallengeRating("0"), 10);
    assert.equal(xpFromChallengeRating("1/8"), 25);
    assert.equal(xpFromChallengeRating("1/4"), 50);
    assert.equal(xpFromChallengeRating("1/2"), 100);
    assert.equal(xpFromChallengeRating("1"), 200);
    assert.equal(xpFromChallengeRating("5"), 1800);
  });

  it("prefers catalog xp when set", () => {
    const data = createDefaultEnemyData({ xp: 999, challengeRating: "1" });
    assert.equal(getEnemyXpValue(data), 999);
  });

  it("falls back to CR when catalog xp is zero", () => {
    const data = createDefaultEnemyData({ xp: 0, challengeRating: "1/2" });
    assert.equal(getEnemyXpValue(data), 100);
  });
});

describe("creditXpForDefeatedEnemies", () => {
  const enemiesBySlug = {
    goblin: { data: createDefaultEnemyData({ xp: 50, challengeRating: "1/4" }) },
  };

  it("credits defeated enemies once per token", () => {
    const state = baseState([enemyToken()]);
    const credited = creditXpForDefeatedEnemies(state, enemiesBySlug);
    assert.equal(credited.xpPool, 50);
    assert.equal(credited.tokens[0]?.xpContributed, true);

    const again = creditXpForDefeatedEnemies(credited, enemiesBySlug);
    assert.equal(again.xpPool, 50);
  });

  it("ignores living enemies and already credited tokens", () => {
    const living = enemyToken({ currentHp: 5, hidden: false });
    const credited = enemyToken({ xpContributed: true });
    const state = baseState([living, credited]);
    const result = creditXpForDefeatedEnemies(state, enemiesBySlug);
    assert.equal(result.xpPool, 0);
  });
});

describe("distributeXpPool", () => {
  it("splits 55 XP between 2 party members as 28/27 favoring lower XP", () => {
    const awards = distributeXpPool(
      55,
      [
        { id: "a", currentXp: 1000 },
        { id: "b", currentXp: 500 },
      ],
      0,
      () => 0
    );
    assert.equal(awards.get("b"), 28);
    assert.equal(awards.get("a"), 27);
    assert.equal([...awards.values()].reduce((sum, n) => sum + n, 0), 55);
  });

  it("dilutes XP when allies are present", () => {
    const preview = previewXpDistribution(100, 4, 12);
    assert.deepEqual(preview, { partyTotal: 25, minEach: 6, maxEach: 7 });

    const awards = distributeXpPool(
      100,
      [
        { id: "a", currentXp: 0 },
        { id: "b", currentXp: 0 },
        { id: "c", currentXp: 0 },
        { id: "d", currentXp: 0 },
      ],
      12,
      () => 0
    );
    assert.equal([...awards.values()].reduce((sum, n) => sum + n, 0), 25);
    assert.deepEqual([...awards.values()].sort((x, y) => y - x), [7, 6, 6, 6]);
  });

  it("breaks ties randomly when current XP is equal", () => {
    const awards = distributeXpPool(
      55,
      [
        { id: "a", currentXp: 500 },
        { id: "b", currentXp: 500 },
      ],
      0,
      () => 0.99
    );
    const values = [...awards.values()].sort((x, y) => y - x);
    assert.deepEqual(values, [28, 27]);
  });
});
