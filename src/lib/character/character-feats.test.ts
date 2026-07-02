import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDmGrantedFeat,
  changeCharacterFeat,
  getAllCharacterFeatIds,
  getCharacterSheetFeats,
  hasMagicInitiateFeat,
  removeCharacterFeat,
} from "@/lib/character/character-feats";
import { createDefaultCharacterData, type CharacterData } from "@/lib/schemas/character";

describe("character-feats", () => {
  it("collects species, level-up, and DM-granted feats in order", () => {
    const data = createDefaultCharacterData({
      featureChoices: {
        variantHumanFeat: "alert",
      },
      levelUpFeats: { "4": "tough", "8": "lucky" },
      dmGrantedFeats: ["observant"],
    });

    const feats = getCharacterSheetFeats(data);
    assert.equal(feats.length, 4);
    assert.equal(feats[0]?.key, "species");
    assert.equal(feats[0]?.featId, "alert");
    assert.equal(feats[1]?.key, "level:4");
    assert.equal(feats[2]?.key, "level:8");
    assert.equal(feats[3]?.key, "dm:0");
    assert.deepEqual(getAllCharacterFeatIds(data), [
      "alert",
      "tough",
      "lucky",
      "observant",
    ]);
  });

  it("adds DM-granted feats with fixed ability bonuses", () => {
    const base = createDefaultCharacterData();
    const next = addDmGrantedFeat(base, "durable");
    assert.deepEqual(next.dmGrantedFeats, ["durable"]);
    assert.equal(next.abilityScores.con, base.abilityScores.con + 1);
  });

  it("removes level-up feats and reverses ability bonuses", () => {
    const base = createDefaultCharacterData({
      levelUpFeats: { "4": "durable" },
    });
    const data: CharacterData = {
      ...base,
      abilityScores: { ...base.abilityScores, con: 11 },
      abilityScoreBreakdown: {
        ...base.abilityScoreBreakdown,
        con: {
          base: 10,
          racial: 0,
          other: 1,
          sources: [
            { label: "Base", value: 10 },
            { label: "Level 4 Feat (Durable)", value: 1 },
          ],
        },
      },
    };

    const next = removeCharacterFeat(data, "level:4");
    assert.deepEqual(next.levelUpFeats, {});
    assert.equal(next.abilityScores.con, 10);
  });

  it("clears Magic Initiate choices when the last magic-initiate feat is removed", () => {
    const data = createDefaultCharacterData({
      featureChoices: {
        variantHumanFeat: "magic-initiate",
        magicInitiateClass: "wizard",
        magicInitiateCantripIds: ["fire-bolt", "mage-hand"],
        magicInitiateSpellId: "shield",
      },
    });
    assert.equal(hasMagicInitiateFeat(data), true);

    const next = removeCharacterFeat(data, "species");
    assert.equal(next.featureChoices?.variantHumanFeat, "");
    assert.equal(next.featureChoices?.magicInitiateClass, "");
    assert.deepEqual(next.featureChoices?.magicInitiateCantripIds, []);
    assert.equal(next.featureChoices?.magicInitiateSpellId, "");
  });

  it("changes a DM-granted feat in place", () => {
    const data = createDefaultCharacterData({
      dmGrantedFeats: ["alert"],
    });
    const next = changeCharacterFeat(data, "dm:0", "lucky");
    assert.deepEqual(next.dmGrantedFeats, ["lucky"]);
  });
});
