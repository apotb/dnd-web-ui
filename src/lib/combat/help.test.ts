import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyHelpGrant,
  consumeHelpGrantsForBeneficiary,
  expireHelpGrantsForHelper,
  getHelpAttackAdvantage,
  resolveAttackRollMode,
} from "@/lib/combat/help";
import { advanceTurn } from "@/lib/combat/turn";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";

function token(
  overrides: Partial<CombatToken> & Pick<CombatToken, "id" | "kind">
): CombatToken {
  return {
    name: overrides.id,
    label: overrides.id,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    placed: true,
    ...overrides,
  };
}

function baseState(tokens: CombatToken[], overrides: Partial<CombatState> = {}): CombatState {
  return {
    gridWidth: 10,
    gridHeight: 10,
    tileFeet: 5,
    backgroundPath: null,
    blockedCells: [],
    tokens,
    excludedPartyCharacterIds: [],
    initiative: {
      status: "ready",
      results: {},
      order: tokens.map((entry) => entry.id),
    },
    turn: {
      active: true,
      index: 0,
      round: 1,
      movementUsedFeet: 0,
      dashUsed: false,
      actionUsed: false,
      bonusActionUsed: false,
      disengageUsed: false,
      actionUsedForTwoWeapon: false,
      twoWeaponFightingUsedOffHand: null,
      freeObjectInteractionUsed: false,
      deathSaveRolled: false,
      multiattackBranchIndex: null,
      multiattackRemaining: {},
    },
    pendingAttacks: [],
    pendingOpportunityAttacks: null,
    reactionUsedTokenIds: [],
    helpGrants: [],
    boardTitle: "Test",
    savedEncounterId: null,
    autoApprove: false,
    autoApproveDm: true,
    xpPool: 0,
    battleParticipantCharacterIds: [],
    battleAmmoPrepared: false,
    excludedAllyIds: [],
    ...overrides,
  };
}

describe("help", () => {
  it("creates a grant and consumes the action", () => {
    const helper = token({ id: "fighter", kind: "party", x: 0, y: 0 });
    const ally = token({ id: "rogue", kind: "party", x: 1, y: 0 });
    const enemy = token({ id: "goblin", kind: "enemy", x: 5, y: 0, currentHp: 7, maxHp: 7 });
    const state = baseState([helper, ally, enemy]);

    const next = applyHelpGrant(state, "fighter", "rogue");

    assert.equal(next.turn.actionUsed, true);
    assert.deepEqual(next.helpGrants, [
      { helperTokenId: "fighter", beneficiaryTokenId: "rogue" },
    ]);
  });

  it("rejects help when ally is not adjacent", () => {
    const helper = token({ id: "fighter", kind: "party", x: 0, y: 0 });
    const ally = token({ id: "rogue", kind: "party", x: 3, y: 0 });
    const enemy = token({ id: "goblin", kind: "enemy", x: 5, y: 0, currentHp: 7, maxHp: 7 });
    const state = baseState([helper, ally, enemy]);

    const next = applyHelpGrant(state, "fighter", "rogue");

    assert.equal(next, state);
    assert.equal(next.turn.actionUsed, false);
    assert.deepEqual(next.helpGrants, []);
  });

  it("grants advantage when beneficiary attacks target adjacent to helper", () => {
    const helper = token({ id: "fighter", kind: "party", x: 1, y: 0, label: "Fighter" });
    const beneficiary = token({ id: "rogue", kind: "party", x: 0, y: 0 });
    const enemy = token({ id: "goblin", kind: "enemy", x: 2, y: 0 });
    const state = baseState([helper, beneficiary, enemy], {
      helpGrants: [{ helperTokenId: "fighter", beneficiaryTokenId: "rogue" }],
    });

    assert.equal(getHelpAttackAdvantage(beneficiary, enemy, state), true);
  });

  it("does not grant advantage when target is not adjacent to helper", () => {
    const helper = token({ id: "fighter", kind: "party", x: 0, y: 0 });
    const beneficiary = token({ id: "rogue", kind: "party", x: 1, y: 0 });
    const enemy = token({ id: "goblin", kind: "enemy", x: 5, y: 0 });
    const state = baseState([helper, beneficiary, enemy], {
      helpGrants: [{ helperTokenId: "fighter", beneficiaryTokenId: "rogue" }],
    });

    assert.equal(getHelpAttackAdvantage(beneficiary, enemy, state), false);
  });

  it("consumes all grants for a beneficiary after an advantaged attack", () => {
    const state = baseState([], {
      helpGrants: [
        { helperTokenId: "fighter", beneficiaryTokenId: "rogue" },
        { helperTokenId: "cleric", beneficiaryTokenId: "rogue" },
        { helperTokenId: "fighter", beneficiaryTokenId: "wizard" },
      ],
    });

    const next = consumeHelpGrantsForBeneficiary(state, "rogue");

    assert.deepEqual(next.helpGrants, [
      { helperTokenId: "fighter", beneficiaryTokenId: "wizard" },
    ]);
  });

  it("expires grants when helper turn starts again", () => {
    const state = baseState([], {
      helpGrants: [
        { helperTokenId: "fighter", beneficiaryTokenId: "rogue" },
        { helperTokenId: "cleric", beneficiaryTokenId: "wizard" },
      ],
    });

    const next = expireHelpGrantsForHelper(state, "fighter");

    assert.deepEqual(next.helpGrants, [
      { helperTokenId: "cleric", beneficiaryTokenId: "wizard" },
    ]);
  });

  it("keeps help grants after helper ends turn until helper turn starts again", () => {
    const helper = token({ id: "fighter", kind: "party", x: 1, y: 0 });
    const beneficiary = token({ id: "rogue", kind: "party", x: 0, y: 0 });
    const enemy = token({ id: "goblin", kind: "enemy", x: 2, y: 0, currentHp: 7, maxHp: 7 });
    const state = baseState([helper, beneficiary, enemy], {
      initiative: {
        status: "ready",
        results: {},
        order: ["fighter", "rogue", "goblin"],
      },
      turn: {
        active: true,
        index: 0,
        round: 1,
        movementUsedFeet: 0,
        dashUsed: false,
        actionUsed: false,
        bonusActionUsed: false,
        disengageUsed: false,
        actionUsedForTwoWeapon: false,
        twoWeaponFightingUsedOffHand: null,
        freeObjectInteractionUsed: false,
        deathSaveRolled: false,
        multiattackBranchIndex: null,
        multiattackRemaining: {},
      },
      helpGrants: [{ helperTokenId: "fighter", beneficiaryTokenId: "rogue" }],
    });

    const afterHelperEndsTurn = advanceTurn(state);

    assert.deepEqual(afterHelperEndsTurn.helpGrants, [
      { helperTokenId: "fighter", beneficiaryTokenId: "rogue" },
    ]);
    assert.equal(getHelpAttackAdvantage(beneficiary, enemy, afterHelperEndsTurn), true);

    const afterRogueEndsTurn = advanceTurn(afterHelperEndsTurn);
    const afterGoblinEndsTurn = advanceTurn(afterRogueEndsTurn);

    assert.deepEqual(afterGoblinEndsTurn.helpGrants, []);
    assert.equal(getHelpAttackAdvantage(beneficiary, enemy, afterGoblinEndsTurn), false);
  });

  it("cancels advantage and disadvantage", () => {
    assert.equal(resolveAttackRollMode(true, true), null);
    assert.equal(resolveAttackRollMode(true, false), "advantage");
    assert.equal(resolveAttackRollMode(false, true), "disadvantage");
    assert.equal(resolveAttackRollMode(false, false), null);
  });
});
