import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ParsedCharacter } from "@/lib/character/utils";
import {
  resetCombatBoard,
  shouldBootstrapDefaultCombatState,
} from "@/lib/combat/state-utils";
import { parseCombatState, type CombatState } from "@/lib/schemas/combat-state";

function character(id: string): ParsedCharacter {
  return {
    id,
    name: id,
    data: {
      basicInfo: { portrait: "" },
      combat: { currentHp: 10, maxHp: 10 },
    },
  } as ParsedCharacter;
}

function stateWithTokens(): CombatState {
  return parseCombatState({
    tokens: [
      {
        id: "token-1",
        kind: "enemy",
        name: "Goblin",
        label: "Goblin",
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        placed: true,
      },
    ],
  });
}

describe("shouldBootstrapDefaultCombatState", () => {
  it("returns true for a fresh empty combat state", () => {
    assert.equal(shouldBootstrapDefaultCombatState(parseCombatState({})), true);
  });

  it("returns false after reset marks all party members excluded", () => {
    const reset = resetCombatBoard(
      parseCombatState({ gridWidth: 30, gridHeight: 40 }),
      [character("char-1"), character("char-2")]
    );
    assert.equal(shouldBootstrapDefaultCombatState(reset), false);
  });

  it("returns false when tokens remain on the board", () => {
    assert.equal(shouldBootstrapDefaultCombatState(stateWithTokens()), false);
  });
});

describe("resetCombatBoard", () => {
  it("preserves custom grid dimensions", () => {
    const reset = resetCombatBoard(
      parseCombatState({ gridWidth: 30, gridHeight: 40, tileFeet: 10 }),
      [character("char-1")]
    );
    assert.equal(reset.gridWidth, 30);
    assert.equal(reset.gridHeight, 40);
    assert.equal(reset.tileFeet, 10);
    assert.deepEqual(reset.tokens, []);
  });
});
