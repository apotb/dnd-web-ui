import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCombatState } from "@/lib/schemas/combat-state";
import { createDefaultEnemyData } from "@/lib/schemas/enemy";
import { createDefaultPartyData, mergePartyData, partyAllySchema } from "@/lib/schemas/party";
import {
  createPartyAllyFromEnemy,
  getAllyArchetypeLabel,
  getAllyRaceClassLine,
  getAllyInitiativeModifier,
  getAllyMaxHp,
  getAllyPassivePerception,
  listPartyAllies,
  parseAllySpeedFt,
  syncAllyCombatToPartyData,
  syncAllyHpToPartyData,
} from "./party-allies";

describe("party-allies", () => {
  it("creates ally from enemy with copied stats and full HP", () => {
    const enemy = {
      slug: "thug",
      name: "Thug",
      data: createDefaultEnemyData({
        hitPoints: { average: 32, formula: "5d8+10" },
        abilityScores: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 11 },
      }),
    };
    const ally = createPartyAllyFromEnemy(enemy);
    assert.equal(ally.name, "Thug");
    assert.equal(ally.sourceEnemySlug, "thug");
    assert.equal(ally.sourceEnemyName, "Thug");
    assert.equal(ally.race, "");
    assert.equal(ally.currentHp, 32);
    assert.equal(getAllyMaxHp(ally), 32);
  });

  it("parses speed feet from enemy speed string", () => {
    assert.equal(parseAllySpeedFt("30 ft."), 30);
    assert.equal(parseAllySpeedFt("fly 60 ft. (hover)"), 60);
    assert.equal(parseAllySpeedFt("—"), null);
  });

  it("derives passive perception from senses or skills", () => {
    const fromSenses = createPartyAllyFromEnemy({
      slug: "scout",
      name: "Scout",
      data: createDefaultEnemyData({ senses: "passive Perception 15" }),
    });
    assert.equal(getAllyPassivePerception(fromSenses), 15);

    const fromSkill = createPartyAllyFromEnemy({
      slug: "guard",
      name: "Guard",
      data: createDefaultEnemyData({
        senses: "",
        skills: [{ name: "Perception", bonus: 3 }],
      }),
    });
    assert.equal(getAllyPassivePerception(fromSkill), 13);
  });

  it("computes initiative from enemy breakdown", () => {
    const ally = createPartyAllyFromEnemy({
      slug: "thug",
      name: "Thug",
      data: createDefaultEnemyData({
        abilityScores: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 11 },
      }),
    });
    assert.equal(getAllyInitiativeModifier(ally), 1);
  });

  it("uses creature archetype label for overview meta", () => {
    const fromName = createPartyAllyFromEnemy({
      slug: "scout",
      name: "Scout",
      data: createDefaultEnemyData({ sizeType: "Medium humanoid, any alignment" }),
    });
    assert.equal(getAllyArchetypeLabel(fromName), "Scout");

    const fromSlug = partyAllySchema.parse({
      name: "Sildar",
      sourceEnemySlug: "noble",
      data: createDefaultEnemyData(),
      currentHp: 9,
      notes: "",
    });
    assert.equal(getAllyArchetypeLabel(fromSlug), "Noble");
  });

  it("builds race + archetype line like party species/class tooltips", () => {
    const humanThug = partyAllySchema.parse({
      name: "Vasili",
      race: "Human",
      sourceEnemyName: "Thug",
      data: createDefaultEnemyData(),
      currentHp: 32,
      notes: "",
    });
    assert.equal(getAllyRaceClassLine(humanThug), "Human Thug");

    const highElfScout = partyAllySchema.parse({
      name: "Lareth",
      race: "Elf (High Elf)",
      sourceEnemyName: "Scout",
      data: createDefaultEnemyData(),
      currentHp: 16,
      notes: "",
    });
    assert.equal(getAllyRaceClassLine(highElfScout), "High Elf Scout");

    const scoutOnly = createPartyAllyFromEnemy({
      slug: "scout",
      name: "Scout",
      data: createDefaultEnemyData(),
    });
    assert.equal(getAllyRaceClassLine(scoutOnly), "Scout");
  });

  it("lists allies by CR then name", () => {
    const partyData = createDefaultPartyData({
      allies: [
        {
          id: "ally-z",
          name: "Zephyr",
          data: createDefaultEnemyData({ challengeRating: "1" }),
          currentHp: 10,
          notes: "",
        },
        {
          id: "ally-a",
          name: "Acolyte",
          data: createDefaultEnemyData({ challengeRating: "1/4" }),
          currentHp: 9,
          notes: "",
        },
        {
          id: "ally-b",
          name: "Bravo",
          data: createDefaultEnemyData({ challengeRating: "1" }),
          currentHp: 20,
          notes: "",
        },
      ],
    });

    const sorted = listPartyAllies(partyData);
    assert.deepEqual(
      sorted.map((ally) => ally.name),
      ["Acolyte", "Bravo", "Zephyr"]
    );
  });

  it("syncs ally HP from combat tokens to party data", () => {
    const partyData = createDefaultPartyData({
      allies: [
        {
          id: "ally-1",
          name: "Sildar",
          data: createDefaultEnemyData({ hitPoints: { average: 27, formula: "" } }),
          currentHp: 27,
          notes: "",
        },
      ],
    });
    const combatState = parseCombatState({
      tokens: [
        {
          id: "token-1",
          kind: "ally",
          allyId: "ally-1",
          name: "Sildar",
          label: "Sildar",
          currentHp: 12,
          maxHp: 27,
        },
      ],
    });

    const synced = syncAllyCombatToPartyData(partyData, combatState);
    assert.equal(synced.allies[0]?.currentHp, 12);
  });

  it("syncAllyHpToPartyData is an alias for syncAllyCombatToPartyData", () => {
    assert.equal(syncAllyHpToPartyData, syncAllyCombatToPartyData);
  });

  it("syncs downed conditions when ally token drops to 0 HP", () => {
    const partyData = createDefaultPartyData({
      allies: [
        {
          id: "ally-1",
          name: "Sildar",
          data: createDefaultEnemyData({ hitPoints: { average: 27, formula: "" } }),
          currentHp: 10,
          conditions: [],
          notes: "",
        },
      ],
    });
    const combatState = parseCombatState({
      tokens: [
        {
          id: "token-1",
          kind: "ally",
          allyId: "ally-1",
          name: "Sildar",
          label: "Sildar",
          currentHp: 0,
          maxHp: 27,
        },
      ],
    });

    const synced = syncAllyCombatToPartyData(partyData, combatState);
    assert.equal(synced.allies[0]?.currentHp, 0);
    assert.ok(synced.allies[0]?.conditions?.includes("unconscious"));
    assert.ok(synced.allies[0]?.conditions?.includes("incapacitated"));
    assert.ok(synced.allies[0]?.conditions?.includes("prone"));
  });

  it("removes downed conditions when ally heals above 0 HP", () => {
    const partyData = createDefaultPartyData({
      allies: [
        {
          id: "ally-1",
          name: "Sildar",
          data: createDefaultEnemyData({ hitPoints: { average: 27, formula: "" } }),
          currentHp: 0,
          conditions: ["unconscious", "incapacitated", "prone"],
          notes: "",
        },
      ],
    });
    const combatState = parseCombatState({
      tokens: [
        {
          id: "token-1",
          kind: "ally",
          allyId: "ally-1",
          name: "Sildar",
          label: "Sildar",
          currentHp: 8,
          maxHp: 27,
        },
      ],
    });

    const synced = syncAllyCombatToPartyData(partyData, combatState);
    assert.equal(synced.allies[0]?.currentHp, 8);
    assert.deepEqual(synced.allies[0]?.conditions, ["prone"]);
  });

  it("enforces downed conditions when ally already at 0 HP without conditions", () => {
    const partyData = createDefaultPartyData({
      allies: [
        {
          id: "ally-1",
          name: "Sildar",
          data: createDefaultEnemyData({ hitPoints: { average: 27, formula: "" } }),
          currentHp: 0,
          conditions: [],
          notes: "",
        },
      ],
    });
    const combatState = parseCombatState({
      tokens: [
        {
          id: "token-1",
          kind: "ally",
          allyId: "ally-1",
          name: "Sildar",
          label: "Sildar",
          currentHp: 0,
          maxHp: 27,
        },
      ],
    });

    const synced = syncAllyCombatToPartyData(partyData, combatState);
    assert.ok(synced.allies[0]?.conditions?.includes("unconscious"));
  });

  it("mergePartyData unions allies by id", () => {
    const enemyData = createDefaultEnemyData();
    const cached = createDefaultPartyData({
      allies: [
        partyAllySchema.parse({
          id: "ally-1",
          name: "Sildar",
          currentHp: 10,
          data: enemyData,
        }),
      ],
    });
    const incoming = createDefaultPartyData({
      allies: [
        partyAllySchema.parse({
          id: "ally-2",
          name: "Ireena",
          currentHp: 20,
          data: enemyData,
        }),
        partyAllySchema.parse({
          id: "ally-1",
          name: "Sildar",
          currentHp: 5,
          data: enemyData,
        }),
      ],
    });

    const merged = mergePartyData(cached, incoming);
    assert.equal(merged.allies.length, 2);
    assert.equal(merged.allies.find((ally) => ally.id === "ally-1")?.currentHp, 5);
    assert.equal(merged.allies.find((ally) => ally.id === "ally-2")?.name, "Ireena");
  });
});
