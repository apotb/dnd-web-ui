import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { removeDeadCharacterTokensFromState } from "./character-death-actions.ts";
import { DEAD_CONDITION_SLUG } from "@/lib/dnd/dying-state";
import { parseCombatState } from "@/lib/schemas/combat-state";

describe("character-death-actions", () => {
  it("removeDeadCharacterTokensFromState drops dead party tokens", () => {
    const state = parseCombatState({
      tokens: [
        {
          id: "char-1",
          kind: "party",
          name: "Aldric",
          label: "A",
          characterId: "char-1",
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          placed: true,
        },
      ],
    });

    const next = removeDeadCharacterTokensFromState(state, [
      {
        characterId: "char-1",
        conditions: [DEAD_CONDITION_SLUG, "unconscious"],
      },
    ]);

    assert.equal(next.tokens.length, 0);
    assert.deepEqual(next.excludedPartyCharacterIds, ["char-1"]);
  });
});
