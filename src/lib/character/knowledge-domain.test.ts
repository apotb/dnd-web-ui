import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveGrantConfigurableFeatures } from "@/lib/character/feature-grant-features";
import {
  resolveAllLanguageGrants,
  resolveAllSkillGrants,
  syncFeatureGrants,
} from "@/lib/character/feature-grant-sync";
import { KNOWLEDGE_DOMAIN_SKILL_GRANT_KEY } from "@/lib/dnd/phb/cleric-domain-grants";
import { PHB_CLASSES } from "@/lib/dnd/phb/classes";
import { createDefaultCharacterData } from "@/lib/schemas/character";

const catalogs = { classes: PHB_CLASSES };

function knowledgeCleric() {
  return createDefaultCharacterData({
    basicInfo: {
      class: "Cleric",
      classes: ["Cleric"],
      subclass: "Knowledge Domain",
    },
    featureChoices: {
      knowledgeDomainLanguages: ["elvish", "dwarvish"],
      knowledgeDomainSkills: ["arcana", "history"],
    },
  });
}

describe("Knowledge Domain (Blessings of Knowledge)", () => {
  it("derives language and skill grant feature rows", () => {
    const data = knowledgeCleric();
    const grants = deriveGrantConfigurableFeatures(data, catalogs);
    const names = grants.map((g) => g.name);
    assert.ok(names.includes("Blessings of Knowledge — Languages"));
    assert.ok(names.includes("Blessings of Knowledge — Skills"));
  });

  it("grants skill proficiencies when choices are set", () => {
    const data = knowledgeCleric();
    const skillGrants = resolveAllSkillGrants(data, catalogs);
    assert.ok(
      skillGrants.some(
        (g) =>
          g.grantKey === KNOWLEDGE_DOMAIN_SKILL_GRANT_KEY &&
          g.skills.includes("arcana") &&
          g.skills.includes("history")
      )
    );
  });

  it("resolves language grants from feature choices", () => {
    const data = knowledgeCleric();
    const languageGrants = resolveAllLanguageGrants(data, catalogs);
    assert.equal(languageGrants.length, 1);
    assert.deepEqual(languageGrants[0]?.slugs, ["elvish", "dwarvish"]);
  });

  it("syncs chosen languages into character languages", () => {
    const synced = syncFeatureGrants(knowledgeCleric(), catalogs);
    assert.ok(synced.languages.length >= 2);
    assert.ok(
      Object.keys(synced.grantedLanguageSlugs ?? {}).length >= 2
    );
  });

  it("removes managed languages when subclass changes away from Knowledge", () => {
    const synced = syncFeatureGrants(knowledgeCleric(), catalogs);
    const withoutKnowledge = syncFeatureGrants(
      {
        ...synced,
        basicInfo: {
          ...synced.basicInfo,
          subclass: "Life Domain",
        },
        featureChoices: {
          ...synced.featureChoices,
          knowledgeDomainLanguages: [],
          knowledgeDomainSkills: [],
        },
      },
      catalogs
    );
    assert.equal(withoutKnowledge.grantedLanguageSlugs, undefined);
    assert.ok(!withoutKnowledge.languages.some((l) => l.toLowerCase() === "elvish"));
  });
});
