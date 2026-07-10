import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatCheckRollModeTooltip,
  getAbilityCheckRollMode,
  getSkillCheckRollMode,
  resolveCheckRollMode,
  type CheckRollSource,
} from "./check-roll-mode.ts";
import { createDefaultCharacterData } from "@/lib/schemas/character";
import type { Item } from "@/lib/schemas/item";
import { PHB_SPECIES } from "@/lib/dnd/phb/species";

const chainMail: Item = {
  id: "chain-mail",
  slug: "chain-mail",
  name: "Chain Mail",
  category: "armor",
  properties: {
    armorClass: 16,
    dexBonus: false,
    strengthRequirement: 13,
    stealthDisadvantage: true,
    armorType: "heavy",
  },
};

function baseData(
  overrides: Parameters<typeof createDefaultCharacterData>[0] = {}
) {
  return createDefaultCharacterData(overrides);
}

describe("check-roll-mode", () => {
  it("resolveCheckRollMode returns null when advantage and disadvantage both apply", () => {
    const sources: CheckRollSource[] = [
      { label: "A", detail: "adv", mode: "advantage" },
      { label: "B", detail: "dis", mode: "disadvantage" },
    ];
    assert.equal(resolveCheckRollMode(sources), null);
  });

  it("equipped stealth-disadvantage armor affects Stealth only", () => {
    const data = baseData({
      inventory: {
        items: [
          {
            id: "armor-1",
            itemId: "chain-mail",
            name: "Chain Mail",
            quantity: 1,
            equipped: true,
          },
        ],
        currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
      },
    });

    const stealth = getSkillCheckRollMode(data, "stealth", {
      catalogItems: { "chain-mail": chainMail },
    });
    assert.equal(stealth.mode, "disadvantage");
    assert.equal(stealth.sources.some((s) => s.label === "Chain Mail"), true);

    const athletics = getSkillCheckRollMode(data, "athletics", {
      catalogItems: { "chain-mail": chainMail },
    });
    assert.equal(athletics.mode, null);
  });

  it("exhaustion level 1 gives disadvantage on all skill checks", () => {
    const data = baseData({
      exhaustionLevels: [
        {
          id: "ex-1",
          reason: "Starvation",
          effect: "Disadvantage on ability checks",
          gainedDate: null,
        },
      ],
    });

    const stealth = getSkillCheckRollMode(data, "stealth");
    assert.equal(stealth.mode, "disadvantage");
    assert.equal(stealth.sources.some((s) => s.label === "Exhaustion"), true);
  });

  it("poisoned condition gives disadvantage on checks", () => {
    const data = baseData({
      combat: {
        ...baseData().combat,
        conditions: ["poisoned"],
      },
    });

    const result = getSkillCheckRollMode(data, "insight");
    assert.equal(result.mode, "disadvantage");
    assert.equal(result.sources.some((s) => s.label === "Poisoned"), true);
  });

  it("sunlight sensitivity affects Perception for Drow", () => {
    const data = baseData({
      basicInfo: {
        ...baseData().basicInfo,
        species: "Elf (Drow)",
      },
    });

    const perception = getSkillCheckRollMode(data, "perception", {
      speciesList: PHB_SPECIES,
    });
    assert.equal(perception.mode, "disadvantage");
    assert.equal(
      perception.sources.some((s) => s.label === "Sunlight Sensitivity"),
      true
    );

    const stealth = getSkillCheckRollMode(data, "stealth", {
      speciesList: PHB_SPECIES,
    });
    assert.equal(stealth.mode, null);
  });

  it("favored enemy gives advantage on Survival and Intelligence skills", () => {
    const data = baseData({
      basicInfo: {
        ...baseData().basicInfo,
        class: "Ranger",
        classes: ["ranger"],
        level: 1,
      },
      featureChoices: {
        ...baseData().featureChoices,
        favoredEnemyPicks: [{ enemy: "Undead", humanoidSpecies: [] }],
      },
    });

    const survival = getSkillCheckRollMode(data, "survival");
    assert.equal(survival.mode, "advantage");
    assert.match(
      survival.sources.find((s) => s.label === "Favored Enemy")?.detail ?? "",
      /Undead/
    );

    const history = getSkillCheckRollMode(data, "history");
    assert.equal(history.mode, "advantage");

    const athletics = getSkillCheckRollMode(data, "athletics");
    assert.equal(athletics.mode, null);
  });

  it("advantage and disadvantage cancel on the same skill", () => {
    const data = baseData({
      basicInfo: {
        ...baseData().basicInfo,
        class: "Ranger",
        classes: ["ranger"],
        level: 1,
      },
      featureChoices: {
        ...baseData().featureChoices,
        favoredEnemyPicks: [{ enemy: "Beasts", humanoidSpecies: [] }],
      },
      exhaustionLevels: [
        {
          id: "ex-1",
          reason: "Starvation",
          effect: "Disadvantage on ability checks",
          gainedDate: null,
        },
      ],
    });

    const survival = getSkillCheckRollMode(data, "survival");
    assert.equal(survival.mode, null);
    assert.equal(survival.sources.length, 2);
  });

  it("getAbilityCheckRollMode applies exhaustion to Dex initiative checks", () => {
    const data = baseData({
      exhaustionLevels: [
        {
          id: "ex-1",
          reason: "Dehydration",
          effect: "Disadvantage on ability checks",
          gainedDate: null,
        },
      ],
    });

    const dex = getAbilityCheckRollMode(data, "dex");
    assert.equal(dex.mode, "disadvantage");
  });

  it("formatCheckRollModeTooltip includes header and sources", () => {
    const tooltip = formatCheckRollModeTooltip({
      mode: "disadvantage",
      sources: [
        {
          label: "Chain Mail",
          detail: "Disadvantage on Stealth checks",
          mode: "disadvantage",
        },
      ],
    });
    assert.match(tooltip ?? "", /Disadvantage on this check/);
    assert.match(tooltip ?? "", /Chain Mail/);
  });
});
