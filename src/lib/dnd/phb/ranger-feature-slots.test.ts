import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getFavoredEnemySlotCount,
  getFavoredTerrainSlotCount,
  normalizeFavoredEnemyPicks,
  normalizeFavoredTerrains,
  getRangerPicksFromChoices,
  rangerHasUnfilledPickSlots,
} from "@/lib/dnd/phb/ranger-feature-slots";

describe("ranger feature slot counts", () => {
  it("returns favored enemy slots by level", () => {
    assert.equal(getFavoredEnemySlotCount(1), 1);
    assert.equal(getFavoredEnemySlotCount(5), 1);
    assert.equal(getFavoredEnemySlotCount(6), 2);
    assert.equal(getFavoredEnemySlotCount(13), 2);
    assert.equal(getFavoredEnemySlotCount(14), 3);
  });

  it("returns favored terrain slots by level", () => {
    assert.equal(getFavoredTerrainSlotCount(1), 1);
    assert.equal(getFavoredTerrainSlotCount(5), 1);
    assert.equal(getFavoredTerrainSlotCount(6), 2);
    assert.equal(getFavoredTerrainSlotCount(9), 2);
    assert.equal(getFavoredTerrainSlotCount(10), 3);
  });
});

describe("normalize ranger picks", () => {
  it("pads enemy and terrain arrays to slot count", () => {
    assert.deepEqual(normalizeFavoredEnemyPicks([], 6), [
      { enemy: "", humanoidSpecies: [] },
      { enemy: "", humanoidSpecies: [] },
    ]);
    assert.deepEqual(normalizeFavoredTerrains(["Forest"], 10), ["Forest", "", ""]);
  });

  it("migrates legacy single fields from featureChoices", () => {
    const { enemyPicks, terrains } = getRangerPicksFromChoices(
      {
        fightingStyle: "",
        favoredEnemy: "Beasts",
        favoredHumanoidSpecies: [],
        favoredTerrain: "Forest",
        favoredEnemyPicks: [],
        favoredTerrains: [],
        variantHumanFeat: "",
        magicInitiateClass: "",
        magicInitiateCantripIds: [],
        magicInitiateSpellId: "",
        bonusDruidCantripId: "",
        acolyteOfNatureSkill: "",
        knowledgeDomainLanguages: [],
        knowledgeDomainSkills: [],
      },
      1
    );
    assert.equal(enemyPicks[0]?.enemy, "Beasts");
    assert.equal(terrains[0], "Forest");
  });

  it("detects unfilled pick slots", () => {
    assert.equal(
      rangerHasUnfilledPickSlots(
        {
          fightingStyle: "",
          favoredEnemy: "",
          favoredHumanoidSpecies: [],
          favoredTerrain: "",
          favoredEnemyPicks: [{ enemy: "Beasts", humanoidSpecies: [] }],
          favoredTerrains: [""],
          variantHumanFeat: "",
          magicInitiateClass: "",
          magicInitiateCantripIds: [],
          magicInitiateSpellId: "",
          bonusDruidCantripId: "",
          acolyteOfNatureSkill: "",
          knowledgeDomainLanguages: [],
          knowledgeDomainSkills: [],
        },
        6
      ),
      true
    );
  });
});
