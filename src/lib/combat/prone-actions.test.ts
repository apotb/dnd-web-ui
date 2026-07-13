import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ParsedCharacter } from "@/lib/character/utils";
import {
  applyCombatGetUp,
  buildCrawlCombatOption,
  buildGetUpCombatOption,
  getGetUpMovementCostFt,
  getGetUpMovementCostForToken,
  isTokenProne,
} from "@/lib/combat/prone-actions";
import { buildTokenStatusContext } from "@/lib/combat/feature-effects";
import { createDefaultCharacterData } from "@/lib/schemas/character";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import { createDefaultEnemyData } from "@/lib/schemas/enemy";

function character(overrides?: {
  conditions?: string[];
  levelUpFeats?: Record<string, string>;
}): ParsedCharacter {
  const data = createDefaultCharacterData({
    basicInfo: {
      name: "Fighter",
      level: 1,
      classes: ["Fighter"],
      species: "human",
    },
    combat: {
      conditions: overrides?.conditions ?? [],
    },
    levelUpFeats: overrides?.levelUpFeats,
  });
  return {
    id: "char-1",
    campaign_id: "camp-1",
    name: "Fighter",
    data,
  } as ParsedCharacter;
}

function activeCombatState(token: CombatToken): CombatState {
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
      deathSaveRolled: false,
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

describe("prone-actions", () => {
  it("detects prone from character conditions", () => {
    const token: CombatToken = {
      id: "token-1",
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
    const parsed = character({ conditions: ["prone"] });
    assert.equal(isTokenProne(token, buildTokenStatusContext([parsed]), parsed), true);
    assert.equal(
      isTokenProne(token, buildTokenStatusContext([character({ conditions: [] })]), null),
      false
    );
  });

  it("calculates Get Up cost from species base speed", () => {
    const human = character();
    assert.equal(getGetUpMovementCostFt(human), 15);

    const woodElf = character();
    woodElf.data.basicInfo.species = "Custom";
    woodElf.data.combat.speed = 35;
    assert.equal(getGetUpMovementCostFt(woodElf), 17);
  });

  it("uses 5 ft for Athlete feat", () => {
    const athlete = character({ levelUpFeats: { "4": "athlete" } });
    assert.equal(getGetUpMovementCostFt(athlete), 5);
  });

  it("uses half enemy speed for NPC tokens", () => {
    const token: CombatToken = {
      id: "enemy-1",
      kind: "enemy",
      name: "Goblin",
      label: "B",
      tooltip: "",
      portraitPath: null,
      x: 1,
      y: 1,
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
      conditions: ["prone"],
    };
    const enemyData = createDefaultEnemyData({ speed: "40 ft." });
    assert.equal(getGetUpMovementCostForToken(token, null, enemyData), 20);
  });

  it("marks Get Up affordable only with enough movement", () => {
    const affordable = buildGetUpCombatOption({ costFeet: 15, remainingMovementFeet: 30 });
    const unaffordable = buildGetUpCombatOption({ costFeet: 15, remainingMovementFeet: 10 });
    assert.equal(affordable.getUp?.affordable, true);
    assert.equal(unaffordable.getUp?.affordable, false);
  });

  it("builds crawl option with 2× movement cost tooltip", () => {
    const affordable = buildCrawlCombatOption({ remainingMovementFeet: 20 });
    const unaffordable = buildCrawlCombatOption({ remainingMovementFeet: 0 });
    assert.equal(affordable.id, "combat:crawl");
    assert.match(affordable.tooltip, /consume an extra foot of movement/);
    assert.equal(affordable.crawl?.affordable, true);
    assert.equal(unaffordable.crawl?.affordable, false);
  });

  it("spends movement and removes prone from enemy tokens", () => {
    const token: CombatToken = {
      id: "enemy-1",
      kind: "enemy",
      name: "Goblin",
      label: "B",
      tooltip: "",
      portraitPath: null,
      x: 1,
      y: 1,
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
      conditions: ["prone", "poisoned"],
      currentHp: 7,
      maxHp: 7,
    };
    const state = activeCombatState(token);
    const next = applyCombatGetUp(state, token.id, 15, 30, false);
    assert.equal(next.turn.movementUsedFeet, 15);
    assert.deepEqual(next.tokens[0]?.conditions, ["poisoned"]);
  });

  it("no-ops when movement is insufficient", () => {
    const token: CombatToken = {
      id: "enemy-1",
      kind: "enemy",
      name: "Goblin",
      label: "B",
      tooltip: "",
      portraitPath: null,
      x: 1,
      y: 1,
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
      conditions: ["prone"],
      currentHp: 7,
      maxHp: 7,
    };
    const state = {
      ...activeCombatState(token),
      turn: {
        ...activeCombatState(token).turn,
        movementUsedFeet: 20,
        actionUsed: true,
      },
    };
    const next = applyCombatGetUp(state, token.id, 15, 30, false);
    assert.equal(next, state);
  });
});
