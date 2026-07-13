import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAttackRollMode } from "@/lib/combat/help";
import {
  getAttackRollAdvantage,
  getAttackRollDisadvantage,
} from "@/lib/combat/targeting";
import type { DerivedAttack } from "@/lib/dnd/attacks";
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

function baseState(tokens: CombatToken[]): CombatState {
  return {
    gridWidth: 10,
    gridHeight: 10,
    tileFeet: 5,
    backgroundPath: null,
    blockedCells: [],
    tokens,
    excludedPartyCharacterIds: [],
    initiative: { status: "ready", results: {}, order: [] },
    turn: { active: true, index: 0, round: 1, movementUsedFeet: 0, dashUsed: false },
    pendingAttacks: [],
    pendingOpportunityAttacks: null,
    boardTitle: "Test",
    savedEncounterId: null,
    autoApprove: false,
    autoApproveDm: true,
    xpPool: 0,
    battleParticipantCharacterIds: [],
    reactionUsedTokenIds: [],
  } as CombatState;
}

const meleeAttack: DerivedAttack = {
  id: "longsword",
  name: "Longsword",
  attackBonus: 5,
  damageDice: "1d8+3",
  damageType: "slashing",
  range: "5 ft",
  notes: "",
  source: "weapon",
};

const saveAttack: DerivedAttack = {
  ...meleeAttack,
  id: "fireball-save",
  rollType: "save",
  saveAbility: "dexterity",
  saveDc: 15,
};

describe("prone attack roll modifiers", () => {
  it("gives disadvantage to a prone attacker", () => {
    const attacker = token({
      id: "prone-goblin",
      kind: "enemy",
      conditions: ["prone"],
    });
    const target = token({ id: "fighter", kind: "party", x: 1, y: 0 });
    const state = baseState([attacker, target]);

    assert.equal(
      getAttackRollDisadvantage(attacker, target, state, meleeAttack),
      true
    );
    assert.equal(getAttackRollAdvantage(attacker, target, state, meleeAttack), false);
  });

  it("gives advantage against an adjacent prone target", () => {
    const attacker = token({ id: "fighter", kind: "party", x: 0, y: 0 });
    const target = token({
      id: "prone-goblin",
      kind: "enemy",
      x: 1,
      y: 0,
      conditions: ["prone"],
    });
    const state = baseState([attacker, target]);

    assert.equal(getAttackRollAdvantage(attacker, target, state, meleeAttack), true);
    assert.equal(
      getAttackRollDisadvantage(attacker, target, state, meleeAttack),
      false
    );
  });

  it("gives disadvantage against a distant prone target", () => {
    const attacker = token({ id: "fighter", kind: "party", x: 0, y: 0 });
    const target = token({
      id: "prone-goblin",
      kind: "enemy",
      x: 2,
      y: 0,
      conditions: ["prone"],
    });
    const state = baseState([attacker, target]);

    assert.equal(getAttackRollAdvantage(attacker, target, state, meleeAttack), false);
    assert.equal(
      getAttackRollDisadvantage(attacker, target, state, meleeAttack),
      true
    );
  });

  it("cancels opposing prone modifiers for an adjacent prone attacker and target", () => {
    const attacker = token({
      id: "prone-goblin",
      kind: "enemy",
      x: 0,
      y: 0,
      conditions: ["prone"],
    });
    const target = token({
      id: "prone-orc",
      kind: "enemy",
      x: 1,
      y: 0,
      conditions: ["prone"],
    });
    const state = baseState([attacker, target]);

    const advantage = getAttackRollAdvantage(attacker, target, state, meleeAttack);
    const disadvantage = getAttackRollDisadvantage(attacker, target, state, meleeAttack);
    assert.equal(advantage, true);
    assert.equal(disadvantage, true);
    assert.equal(resolveAttackRollMode(advantage, disadvantage), null);
  });

  it("does not apply prone modifiers to saving throws", () => {
    const attacker = token({
      id: "prone-caster",
      kind: "enemy",
      conditions: ["prone"],
    });
    const target = token({
      id: "prone-goblin",
      kind: "enemy",
      x: 2,
      y: 0,
      conditions: ["prone"],
    });
    const state = baseState([attacker, target]);

    assert.equal(getAttackRollAdvantage(attacker, target, state, saveAttack), false);
    assert.equal(getAttackRollDisadvantage(attacker, target, state, saveAttack), false);
  });
});
