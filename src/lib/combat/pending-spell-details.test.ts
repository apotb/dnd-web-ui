import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CombatOption } from "@/lib/combat/combat-options";
import {
  attachSpellDetailsToPending,
  resolvePendingSpellDetailsForDeclareCast,
} from "@/lib/combat/pending-spell-details";
import { createPendingSpellCast } from "@/lib/combat/pending-attack-builder";
import type { CombatToken } from "@/lib/schemas/combat-state";

function token(): CombatToken {
  return {
    id: "pc-1",
    kind: "character",
    characterId: "char-1",
    name: "Cleric",
    label: "A",
    tooltip: "",
    portraitPath: null,
    x: 3,
    y: 3,
    width: 1,
    height: 1,
    placed: true,
    damageTaken: 0,
    currentHp: 20,
    maxHp: 20,
    hasCollision: false,
    isObject: false,
    itemPickup: false,
    pickupQuantity: 1,
    hidden: false,
    activeEffects: [],
  };
}

function blessDeclareOption(): CombatOption {
  return {
    id: "spell-cast:bless",
    name: "Bless",
    subtitle: "Spell · 30 feet",
    tooltip: "",
    kind: "action",
    spellCast: {
      spellId: "bless",
      characterSpellId: "spell-bless",
      level: 1,
      castSlotLevel: 1,
      castingCost: "action",
    },
  };
}

describe("pending spell details", () => {
  it("includes full catalog metadata for declare-only casts", () => {
    const details = resolvePendingSpellDetailsForDeclareCast(blessDeclareOption());
    assert.ok(details);
    assert.equal(details.spellId, "bless");
    assert.equal(details.isDeclarationOnly, true);
    assert.equal(details.castSlotLevel, 1);
    assert.ok(details.castingTime);
    assert.ok(details.range);
    assert.ok(details.duration);
    assert.ok(details.components);
    assert.ok(details.description);
    assert.equal(details.targetingSummary, `Range: ${details.range}`);
  });

  it("creates a pending spell cast for the DM tray", () => {
    const pending = createPendingSpellCast(token(), blessDeclareOption());
    assert.ok(pending);
    assert.equal(pending.rollType, "auto");
    assert.equal(pending.targets.length, 0);
    assert.equal(pending.spellDetails?.isDeclarationOnly, true);
    assert.equal(pending.spellDetails?.spellId, "bless");
    assert.ok(pending.spellDetails?.materialLine || pending.spellDetails?.components);
  });

  it("attaches targeting summary for offensive spell attacks", () => {
    const option: CombatOption = {
      id: "attack:guiding-bolt",
      name: "Guiding Bolt",
      subtitle: "Spell attack",
      tooltip: "",
      kind: "attack",
      spellCast: {
        spellId: "guiding-bolt",
        characterSpellId: "spell-gb",
        level: 1,
        castSlotLevel: 2,
        castingCost: "action",
      },
      attack: {
        id: "guiding-bolt",
        name: "Guiding Bolt",
        source: "spell",
        spellLevel: 1,
        castSlotLevel: 2,
        spellCatalogSlug: "guiding-bolt",
        range: "120 feet",
        damageDice: "4d6",
        damageType: "radiant",
        attackBonus: 5,
        rollType: "attack",
      },
    };

    const pending = attachSpellDetailsToPending(
      {
        id: "pending-1",
        attackerTokenId: "pc-1",
        optionId: option.id,
        optionName: option.name,
        actionCost: "action",
        isOpportunityAttack: false,
        skipDmReview: false,
        rollType: "attack",
        status: "awaiting-dm-review",
        targets: [{ tokenId: "enemy-1", label: "Goblin B", ac: 15, currentHp: 7, maxHp: 7 }],
        narration: "",
      },
      option,
      option.attack ?? null
    );

    assert.ok(pending.spellDetails);
    assert.equal(pending.spellDetails.isDeclarationOnly, false);
    assert.equal(pending.spellDetails.castSlotLevel, 2);
    assert.match(pending.spellDetails.targetingSummary ?? "", /Goblin B/);
    assert.ok(pending.spellDetails.description);
    assert.ok(pending.spellDetails.components);
  });
});
