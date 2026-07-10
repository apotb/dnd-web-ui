import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isImplementedCombatOption } from "@/lib/combat/combat-options";
import { inferActionCost } from "@/lib/dnd/character-actions";
import {
  applyCombatEffectEnter,
  applyCombatEffectExit,
  buildEmergeFromShellCombatOption,
  canTakeReactions,
  filterOptionGroupsForTokenEffects,
  getCombatEffectAcBonus,
  getCombatEffectSaveRollMode,
  getCombatEffectSpeedOverride,
  getTokenStatusLabels,
  hasCombatEffect,
  isRegisteredFeatureEnterAction,
  isTokenIncapacitated,
  isTokenInShellDefense,
  resolveEffectiveSaveRoll,
  SHELL_DEFENSE_EFFECT_ID,
  SHELL_DEFENSE_ENTER_ACTION_ID,
} from "@/lib/combat/feature-effects";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";

function makeToken(overrides: Partial<CombatToken> = {}): CombatToken {
  return {
    id: "token-1",
    kind: "party",
    name: "Tortle",
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
    ...overrides,
  };
}

function makeState(token: CombatToken, extraTokens: CombatToken[] = []): CombatState {
  const tokens = [token, ...extraTokens];
  return {
    gridWidth: 20,
    gridHeight: 20,
    tileFeet: 5,
    backgroundPath: null,
    blockedCells: [],
    tokens,
    excludedPartyCharacterIds: [],
    initiative: { status: "ready", results: {}, order: tokens.map((entry) => entry.id) },
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

function livingEnemyToken(): CombatToken {
  return makeToken({
    id: "enemy-1",
    kind: "enemy",
    name: "Goblin",
    label: "B",
    currentHp: 5,
    enemySlug: "goblin",
  });
}

describe("feature-effects", () => {
  it("registers Shell Defense enter action", () => {
    assert.equal(isRegisteredFeatureEnterAction(SHELL_DEFENSE_ENTER_ACTION_ID), true);
  });

  it("infers Shell Defense enter as an action despite emerge bonus-action text", () => {
    const description =
      "As an action, you can withdraw into your shell. Until you emerge, you gain a +4 bonus to AC, advantage on Strength and Constitution saving throws, and disadvantage on Dexterity saving throws, and you are prone. Your speed is 0 and can't increase. You can't take reactions, and the only action you can take is a bonus action to emerge from your shell.";
    assert.equal(inferActionCost(description), "action");
  });

  it("applies shell defense on enter and marks action used", () => {
    const token = makeToken();
    const state = makeState(token, [livingEnemyToken()]);
    const next = applyCombatEffectEnter(state, token.id, SHELL_DEFENSE_EFFECT_ID);

    assert.equal(next.turn.actionUsed, true);
    assert.equal(hasCombatEffect(next.tokens[0], SHELL_DEFENSE_EFFECT_ID), true);
    assert.equal(isTokenInShellDefense(next.tokens[0]), true);
  });

  it("removes shell defense on exit and marks bonus action used", () => {
    const token = makeToken({ activeEffects: [SHELL_DEFENSE_EFFECT_ID] });
    const state = makeState(token, [livingEnemyToken()]);
    const next = applyCombatEffectExit(state, token.id, SHELL_DEFENSE_EFFECT_ID);

    assert.equal(next.turn.bonusActionUsed, true);
    assert.equal(hasCombatEffect(next.tokens[0], SHELL_DEFENSE_EFFECT_ID), false);
  });

  it("applies shell mechanical modifiers", () => {
    const token = makeToken({ activeEffects: [SHELL_DEFENSE_EFFECT_ID] });

    assert.equal(getCombatEffectAcBonus(token), 4);
    assert.equal(getCombatEffectSpeedOverride(token, 30), 0);
    assert.equal(getCombatEffectSaveRollMode(token, "str"), "advantage");
    assert.equal(getCombatEffectSaveRollMode(token, "con"), "advantage");
    assert.equal(getCombatEffectSaveRollMode(token, "dex"), "disadvantage");
    assert.equal(canTakeReactions(token), false);
    assert.deepEqual(getTokenStatusLabels(token), ["In Shell", "Prone"]);
  });

  it("resolves save advantage and disadvantage", () => {
    assert.equal(resolveEffectiveSaveRoll(8, 15, "advantage"), 15);
    assert.equal(resolveEffectiveSaveRoll(8, 15, "disadvantage"), 8);
  });

  it("restricts action panel while shelled", () => {
    const token = makeToken({ activeEffects: [SHELL_DEFENSE_EFFECT_ID] });
    const filtered = filterOptionGroupsForTokenEffects(
      token,
      {
        actions: [{ id: "action:core:dash" }],
        bonusActions: [{ id: "bonus:attack" }],
      },
      { bonusActionUsed: false }
    );

    assert.deepEqual(filtered.actions, []);
    assert.equal(filtered.bonusActions.length, 1);
    assert.equal(
      (filtered.bonusActions[0] as { id: string }).id,
      buildEmergeFromShellCombatOption().id
    );
  });

  it("marks shell defense options as implemented", () => {
    const emerge = buildEmergeFromShellCombatOption();
    assert.equal(isImplementedCombatOption(emerge), true);
    assert.equal(
      isImplementedCombatOption({
        id: `action:${SHELL_DEFENSE_ENTER_ACTION_ID}`,
        name: "Shell Defense",
        subtitle: "Action",
        tooltip: "",
        kind: "action",
        action: {
          id: SHELL_DEFENSE_ENTER_ACTION_ID,
          name: "Shell Defense",
          cost: "action",
          description: "",
          source: "feature",
        },
      }),
      true
    );
  });

  it("treats party tokens as incapacitated at 0 HP from character sheet context", () => {
    const token = makeToken({
      characterId: "fighter-char",
      currentHp: undefined,
    });

    assert.equal(
      isTokenIncapacitated(token, { hpByCharacterId: { "fighter-char": 0 } }),
      true
    );
    assert.equal(
      isTokenIncapacitated(token, { hpByCharacterId: { "fighter-char": 5 } }),
      false
    );
  });
});
