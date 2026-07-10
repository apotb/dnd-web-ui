import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getEngagedHostileTokens,
  getOpportunityAttackReactors,
  isTokenEngaged,
} from "@/lib/combat/engagement";
import { buildTokenStatusContext } from "@/lib/combat/feature-effects";
import {
  getAttackRollDisadvantage,
  hasRangedAttackAdjacentDisadvantage,
} from "@/lib/combat/targeting";
import type { DerivedAttack } from "@/lib/dnd/attacks";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";
import type { ParsedCharacter } from "@/lib/character/utils";

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

const longbowAttack: DerivedAttack = {
  id: "longbow",
  name: "Longbow",
  attackBonus: 5,
  damageDice: "1d8+3",
  damageType: "piercing",
  range: "150/600 ft",
  notes: "",
  source: "weapon",
};

describe("engagement incapacitation", () => {
  it("ignores downed party tokens for ranged adjacent disadvantage", () => {
    const enemy = token({ id: "goblin", kind: "enemy", x: 1, y: 0 });
    const downedPlayer = token({
      id: "fighter",
      kind: "party",
      characterId: "fighter-char",
      x: 0,
      y: 0,
      currentHp: 0,
      maxHp: 20,
    });
    const state = baseState([enemy, downedPlayer]);

    assert.equal(getEngagedHostileTokens(enemy, state).length, 0);
    assert.equal(isTokenEngaged(enemy, state), false);
    assert.equal(
      hasRangedAttackAdjacentDisadvantage(enemy, state, longbowAttack),
      false
    );
    assert.equal(
      getAttackRollDisadvantage(enemy, downedPlayer, state, longbowAttack),
      false
    );
  });

  it("still applies ranged adjacent disadvantage against active hostiles", () => {
    const enemy = token({ id: "goblin", kind: "enemy", x: 1, y: 0 });
    const player = token({
      id: "fighter",
      kind: "party",
      characterId: "fighter-char",
      x: 0,
      y: 0,
      currentHp: 12,
      maxHp: 20,
    });
    const state = baseState([enemy, player]);

    assert.equal(getEngagedHostileTokens(enemy, state).length, 1);
    assert.equal(isTokenEngaged(enemy, state), true);
    assert.equal(
      hasRangedAttackAdjacentDisadvantage(enemy, state, longbowAttack),
      true
    );
  });

  it("ignores defeated enemies when a party archer is adjacent", () => {
    const archer = token({ id: "archer", kind: "party", x: 0, y: 0, currentHp: 10, maxHp: 10 });
    const defeatedEnemy = token({
      id: "goblin",
      kind: "enemy",
      x: 1,
      y: 0,
      currentHp: 0,
      maxHp: 7,
    });
    const state = baseState([archer, defeatedEnemy]);

    assert.equal(getEngagedHostileTokens(archer, state).length, 0);
    assert.equal(
      hasRangedAttackAdjacentDisadvantage(archer, state, longbowAttack),
      false
    );
  });
});

function parsedCharacter(id: string, currentHp: number): ParsedCharacter {
  return {
    id,
    name: id,
    data: {
      basicInfo: { name: id, species: "Human", classes: ["Fighter"] },
      combat: { currentHp, maxHp: 20, tempHp: 0, ac: 16, conditions: [] },
    },
  } as ParsedCharacter;
}

describe("opportunity attack incapacitation", () => {
  it("excludes downed party tokens when an enemy leaves melee", () => {
    const enemy = token({ id: "goblin", kind: "enemy", x: 1, y: 0 });
    const downedPlayer = token({
      id: "fighter",
      kind: "party",
      characterId: "fighter-char",
      x: 0,
      y: 0,
      currentHp: 0,
      maxHp: 20,
    });
    const state = baseState([enemy, downedPlayer]);
    const context = buildTokenStatusContext([parsedCharacter("fighter-char", 0)]);

    const reactors = getOpportunityAttackReactors(
      enemy,
      { x: 2, y: 0 },
      state,
      false,
      context
    );

    assert.equal(reactors.length, 0);
  });

  it("excludes party tokens at 0 HP on character sheet when token.currentHp is unset", () => {
    const enemy = token({ id: "goblin", kind: "enemy", x: 1, y: 0 });
    const downedPlayer = token({
      id: "fighter",
      kind: "party",
      characterId: "fighter-char",
      x: 0,
      y: 0,
      maxHp: 20,
    });
    const state = baseState([enemy, downedPlayer]);
    const context = buildTokenStatusContext([parsedCharacter("fighter-char", 0)]);

    const reactors = getOpportunityAttackReactors(
      enemy,
      { x: 2, y: 0 },
      state,
      false,
      context
    );

    assert.equal(reactors.length, 0);
  });

  it("includes active party tokens when an enemy leaves melee", () => {
    const enemy = token({ id: "goblin", kind: "enemy", x: 1, y: 0 });
    const player = token({
      id: "fighter",
      kind: "party",
      characterId: "fighter-char",
      x: 0,
      y: 0,
      currentHp: 12,
      maxHp: 20,
    });
    const state = baseState([enemy, player]);
    const context = buildTokenStatusContext([parsedCharacter("fighter-char", 12)]);

    const reactors = getOpportunityAttackReactors(
      enemy,
      { x: 2, y: 0 },
      state,
      false,
      context
    );

    assert.equal(reactors.length, 1);
    assert.equal(reactors[0]?.id, "fighter");
  });
});
