import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseEnemyActions } from "@/lib/combat/enemy-action-parser";
import {
  buildInitialMultiattackRemaining,
  decrementMultiattackRemaining,
  ensureMultiattackTurnState,
  getMultiattackMaxForWeapon,
  getMultiattackSpec,
  parseMultiattackDescription,
  totalMultiattackRemaining,
} from "@/lib/combat/multiattack";
import { applyResolvedAttack } from "@/lib/combat/attack-resolution";
import { getCombatOptionGroupsForToken } from "@/lib/combat/combat-options";
import { advanceTurn } from "@/lib/combat/turn";
import { createDefaultEnemyData } from "@/lib/schemas/enemy";
import type { CombatState, PendingAttack } from "@/lib/schemas/combat-state";

describe("multiattack parser", () => {
  it("parses thug two melee attacks", () => {
    const parsedActions = parseEnemyActions([
      { name: "Multiattack", description: "The thug makes two melee attacks." },
      {
        name: "Mace",
        description:
          "Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 5 (1d6 + 2) bludgeoning damage.",
      },
    ]);
    const spec = parseMultiattackDescription(
      "The thug makes two melee attacks.",
      parsedActions
    );
    assert.equal(spec.branches.length, 1);
    assert.equal(spec.branches[0].categoryFilter, "melee");
    const remaining = buildInitialMultiattackRemaining(spec.branches[0], parsedActions);
    assert.equal(remaining.mace, 2);
  });

  it("parses dragon bite and claw counts", () => {
    const parsedActions = parseEnemyActions([
      {
        name: "Multiattack",
        description:
          "The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.",
      },
      {
        name: "Bite",
        description:
          "Melee Weapon Attack: +14 to hit, reach 10 ft., one target. Hit: 19 (2d10 + 8) piercing damage.",
      },
      {
        name: "Claw",
        description:
          "Melee Weapon Attack: +14 to hit, reach 5 ft., one target. Hit: 15 (2d6 + 8) slashing damage.",
      },
    ]);
    const spec = getMultiattackSpec([
      {
        name: "Multiattack",
        description:
          "The dragon can use its Frightful Presence. It then makes three attacks: one with its bite and two with its claws.",
      },
      parsedActions[1].action,
      parsedActions[2].action,
    ]);
    assert.ok(spec?.preamble?.includes("Frightful Presence"));
    assert.equal(spec?.branches[0].weaponLimits.bite, 1);
    assert.equal(spec?.branches[0].weaponLimits.claw, 2);
  });

  it("parses Bandit Captain alternative branches", () => {
    const parsedActions = parseEnemyActions([
      {
        name: "Multiattack",
        description:
          "The captain makes three melee attacks: two with its scimitar and one with its dagger. Or the captain makes two ranged attacks with its daggers.",
      },
      {
        name: "Scimitar",
        description:
          "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) slashing damage.",
      },
      {
        name: "Dagger",
        description:
          "Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 6 (1d6 + 3) slashing damage.",
      },
    ]);
    const spec = parseMultiattackDescription(
      parsedActions[0].action.description,
      parsedActions
    );
    assert.equal(spec.branches.length, 2);
    assert.equal(spec.branches[0].weaponLimits.scimitar, 2);
    assert.equal(spec.branches[0].weaponLimits.dagger, 1);
    assert.equal(spec.branches[1].weaponLimits.dagger, 2);
  });

  it("decrements remaining attack counts", () => {
    let remaining = { mace: 2 };
    remaining = decrementMultiattackRemaining(remaining, "Mace");
    assert.equal(remaining.mace, 1);
    remaining = decrementMultiattackRemaining(remaining, "Mace");
    assert.equal(remaining.mace, undefined);
    assert.equal(totalMultiattackRemaining(remaining), 0);
  });

  it("ensureMultiattackTurnState restores full remaining at turn start", () => {
    const actions = [
      { name: "Multiattack", description: "The thug makes two melee attacks." },
      {
        name: "Mace",
        description:
          "Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 5 (1d6 + 2) bludgeoning damage.",
      },
    ];
    const ensured = ensureMultiattackTurnState(
      {
        multiattackBranchIndex: 0,
        multiattackRemaining: { mace: 1 },
        actionUsed: false,
        multiattackTokenId: null,
      },
      actions,
      "enemy-1"
    );
    assert.equal(ensured.multiattackRemaining.mace, 2);
    assert.equal(ensured.multiattackTokenId, "enemy-1");
  });

  it("ensureMultiattackTurnState restores when actionUsed is stale but token ownership reset", () => {
    const actions = [
      { name: "Multiattack", description: "The thug makes two melee attacks." },
      {
        name: "Mace",
        description:
          "Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 5 (1d6 + 2) bludgeoning damage.",
      },
    ];
    const ensured = ensureMultiattackTurnState(
      {
        multiattackBranchIndex: 0,
        multiattackRemaining: {},
        actionUsed: true,
        multiattackTokenId: null,
      },
      actions,
      "enemy-1"
    );
    assert.equal(ensured.multiattackRemaining.mace, 2);
    assert.equal(ensured.multiattackTokenId, "enemy-1");
  });

  it("ensureMultiattackTurnState initializes single-branch remaining", () => {
    const actions = [
      { name: "Multiattack", description: "The thug makes two melee attacks." },
      {
        name: "Mace",
        description:
          "Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 5 (1d6 + 2) bludgeoning damage.",
      },
    ];
    const ensured = ensureMultiattackTurnState(
      { multiattackBranchIndex: null, multiattackRemaining: {}, actionUsed: false, multiattackTokenId: null },
      actions,
      "enemy-1"
    );
    assert.equal(ensured.multiattackBranchIndex, 0);
    assert.equal(ensured.multiattackRemaining.mace, 2);
  });

  it("getMultiattackMaxForWeapon returns per-weapon and pool limits", () => {
    const parsedActions = parseEnemyActions([
      {
        name: "Multiattack",
        description:
          "The captain makes three melee attacks: two with its scimitar and one with its dagger.",
      },
      {
        name: "Scimitar",
        description:
          "Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 6 (1d6 + 3) slashing damage.",
      },
      {
        name: "Dagger",
        description:
          "Melee or Ranged Weapon Attack: +5 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 6 (1d6 + 3) slashing damage.",
      },
    ]);
    const spec = parseMultiattackDescription(
      parsedActions[0].action.description,
      parsedActions
    );
    const branch = spec.branches[0];
    assert.equal(
      getMultiattackMaxForWeapon(branch, parsedActions[1], parsedActions),
      2
    );
    assert.equal(
      getMultiattackMaxForWeapon(branch, parsedActions[2], parsedActions),
      1
    );

    const thugActions = parseEnemyActions([
      { name: "Multiattack", description: "The thug makes two melee attacks." },
      {
        name: "Mace",
        description:
          "Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 5 (1d6 + 2) bludgeoning damage.",
      },
    ]);
    const thugSpec = parseMultiattackDescription(
      thugActions[0].action.description,
      thugActions
    );
    assert.equal(
      getMultiattackMaxForWeapon(thugSpec.branches[0], thugActions[1], thugActions),
      2
    );
  });

  it("applyResolvedAttack initializes and decrements multiattack on first strike", () => {
    const enemyActions = [
      { name: "Multiattack", description: "The thug makes two melee attacks." },
      {
        name: "Mace",
        description:
          "Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 5 (1d6 + 2) bludgeoning damage.",
      },
    ];
    const state: CombatState = {
      gridWidth: 20,
      gridHeight: 20,
      tileFeet: 5,
      backgroundPath: null,
      blockedCells: [],
      tokens: [
        {
          id: "enemy-1",
          kind: "enemy",
          name: "Thug",
          label: "A",
          tooltip: "",
          portraitPath: null,
          enemySlug: "thug",
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          placed: true,
          damageTaken: 0,
          currentHp: 32,
          maxHp: 32,
          hasCollision: false,
          isObject: false,
          itemPickup: false,
          pickupQuantity: 1,
          hidden: false,
          activeEffects: [],
        },
      ],
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
        multiattackBranchIndex: null,
        multiattackRemaining: {},
        multiattackTokenId: null,
      },
      pendingAttacks: [],
      pendingOpportunityAttacks: null,
      boardTitle: "Combat",
      savedEncounterId: null,
      autoApprove: false,
      reactionUsedTokenIds: [],
    };
    const pending: PendingAttack = {
      id: "pending-1",
      attackerTokenId: "enemy-1",
      optionId: "attack:mace",
      optionName: "Mace",
      actionCost: "multiattack",
      isOpportunityAttack: false,
      skipDmReview: false,
      rollType: "attack",
      attackBonus: 4,
      damageType: "bludgeoning",
      damageDice: "1d6+2",
      isMainHandWeapon: false,
      isAoe: false,
      status: "awaiting-dm-review",
      targets: [
        {
          tokenId: "target-1",
          label: "Target",
          damageTakenBefore: 0,
          requiresSave: false,
          saveSubmitted: false,
          needsDmSave: false,
          attackDisadvantage: false,
          attackAdvantage: false,
          saveAdvantage: false,
          saveDisadvantage: false,
          hit: true,
          damageAmount: 5,
        },
      ],
      narration: "",
    };

    const { next } = applyResolvedAttack(state, pending, {}, {
      thug: { data: createDefaultEnemyData({ actions: enemyActions }) },
    });

    assert.equal(next.turn.actionUsed, true);
    assert.equal(next.turn.multiattackBranchIndex, 0);
    assert.equal(next.turn.multiattackRemaining.mace, 1);
    assert.equal(next.turn.multiattackTokenId, "enemy-1");
  });

  it("advanceTurn clears multiattack state for the next combatant", () => {
    const enemyActions = [
      { name: "Multiattack", description: "The thug makes two melee attacks." },
      {
        name: "Mace",
        description:
          "Melee Weapon Attack: +4 to hit, reach 5 ft., one creature. Hit: 5 (1d6 + 2) bludgeoning damage.",
      },
    ];
    const state: CombatState = {
      gridWidth: 20,
      gridHeight: 20,
      tileFeet: 5,
      backgroundPath: null,
      blockedCells: [],
      tokens: [
        {
          id: "enemy-1",
          kind: "enemy",
          name: "Thug",
          label: "A",
          tooltip: "",
          portraitPath: null,
          enemySlug: "thug",
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          placed: true,
          damageTaken: 0,
          currentHp: 32,
          maxHp: 32,
          hasCollision: false,
          isObject: false,
          itemPickup: false,
          pickupQuantity: 1,
          hidden: false,
          activeEffects: [],
        },
        {
          id: "enemy-2",
          kind: "enemy",
          name: "Thug",
          label: "B",
          tooltip: "",
          portraitPath: null,
          enemySlug: "thug",
          x: 1,
          y: 0,
          width: 1,
          height: 1,
          placed: true,
          damageTaken: 0,
          currentHp: 32,
          maxHp: 32,
          hasCollision: false,
          isObject: false,
          itemPickup: false,
          pickupQuantity: 1,
          hidden: false,
          activeEffects: [],
        },
      ],
      excludedPartyCharacterIds: [],
      initiative: { status: "ready", results: {}, order: ["enemy-1", "enemy-2"] },
      turn: {
        active: true,
        index: 0,
        round: 1,
        movementUsedFeet: 0,
        dashUsed: false,
        actionUsedForTwoWeapon: false,
        twoWeaponFightingUsedOffHand: null,
        actionUsed: true,
        bonusActionUsed: false,
        disengageUsed: false,
        freeObjectInteractionUsed: false,
        multiattackBranchIndex: 0,
        multiattackRemaining: { mace: 1 },
        multiattackTokenId: "enemy-1",
      },
      pendingAttacks: [],
      pendingOpportunityAttacks: null,
      boardTitle: "Combat",
      savedEncounterId: null,
      autoApprove: false,
      reactionUsedTokenIds: [],
    };

    const next = advanceTurn(state);
    assert.equal(next.turn.index, 1);
    assert.equal(next.turn.actionUsed, false);
    assert.equal(next.turn.multiattackBranchIndex, null);
    assert.deepEqual(next.turn.multiattackRemaining, {});
    assert.equal(next.turn.multiattackTokenId, null);

    const groups = getCombatOptionGroupsForToken(next.tokens[1]!, {
      character: null,
      enemyData: createDefaultEnemyData({ actions: enemyActions }),
      catalogItems: {},
      classCatalog: [],
      featureCatalogs: { species: [] },
      actionUsedForTwoWeapon: false,
      twoWeaponFightingUsedOffHand: null,
      actionUsed: next.turn.actionUsed,
      bonusActionUsed: next.turn.bonusActionUsed,
      dashUsed: next.turn.dashUsed,
      freeObjectInteractionUsed: next.turn.freeObjectInteractionUsed,
      combatState: next,
      token: next.tokens[1]!,
      canUseObject: false,
    });

    assert.equal(groups.multiattackActions.length, 1);
    assert.deepEqual(groups.multiattackActions[0]?.multiattackUses, { remaining: 2, max: 2 });
  });
});
