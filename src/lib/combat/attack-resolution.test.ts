import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyResolvedAttack } from "@/lib/combat/attack-resolution";
import { hasDyingCondition } from "@/lib/dnd/dying-state";
import type { ParsedCharacter } from "@/lib/character/utils";
import type { CombatState, CombatToken, PendingAttack } from "@/lib/schemas/combat-state";

function partyToken(overrides: Partial<CombatToken> = {}): CombatToken {
  return {
    id: "party-1",
    kind: "party",
    characterId: "char-1",
    name: "Fighter",
    label: "A",
    tooltip: "",
    portraitPath: null,
    x: 5,
    y: 5,
    width: 1,
    height: 1,
    placed: true,
    damageTaken: 0,
    currentHp: 10,
    maxHp: 20,
    hasCollision: false,
    isObject: false,
    itemPickup: false,
    pickupQuantity: 1,
    hidden: false,
    activeEffects: [],
    ...overrides,
  };
}

function partyCharacter(currentHp = 10): ParsedCharacter {
  return {
    id: "char-1",
    data: {
      combat: {
        ac: 16,
        maxHp: 20,
        currentHp,
        tempHp: 0,
        conditions: [],
        deathSaves: { successes: 0, failures: 0 },
      },
    },
  } as ParsedCharacter;
}

function pendingAttack(targetTokenId: string, damage: number): PendingAttack {
  return {
    id: "pending-1",
    attackerTokenId: "enemy-1",
    targets: [{ tokenId: targetTokenId, finalDamage: damage }],
    status: "approved",
  } as PendingAttack;
}

function combatState(): CombatState {
  return {
    gridWidth: 20,
    gridHeight: 20,
    tileFeet: 5,
    backgroundPath: null,
    blockedCells: [],
    tokens: [partyToken()],
    excludedPartyCharacterIds: [],
    initiative: { status: "ready", results: {}, order: ["party-1"] },
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
    autoApproveDm: false,
    reactionUsedTokenIds: [],
  };
}

describe("applyResolvedAttack", () => {
  it("includes dying conditions and reset death saves when damage drops a party member to 0 HP", () => {
    const state = combatState();
    const pending = pendingAttack("party-1", 10);
    const charactersById = { "char-1": partyCharacter(10) };

    const { characterUpdates } = applyResolvedAttack(
      state,
      pending,
      charactersById
    );

    assert.equal(characterUpdates.length, 1);
    const update = characterUpdates[0];
    assert.equal(update.currentHp, 0);
    assert.ok(update.conditions?.includes("dying"));
    assert.ok(update.conditions?.includes("unconscious"));
    assert.deepEqual(update.deathSaves, { successes: 0, failures: 0 });
    assert.ok(
      hasDyingCondition({
        ...charactersById["char-1"].data.combat,
        currentHp: update.currentHp,
        conditions: update.conditions,
      })
    );
  });
});
