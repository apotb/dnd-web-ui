import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deriveGrantConfigurableFeatures } from "@/lib/character/feature-grant-features";
import { resolveAllSkillGrants } from "@/lib/character/feature-grant-sync";
import { resolveAllSpellGrants } from "@/lib/character/spell-grants";
import { PHB_CLASSES } from "@/lib/dnd/phb/classes";
import { createDefaultCharacterData } from "@/lib/schemas/character";

function clericNatureCharacter() {
  return createDefaultCharacterData({
    basicInfo: {
      class: "Cleric",
      classes: ["Cleric"],
      subclass: "Nature Domain",
    },
    featureChoices: {
      bonusDruidCantripId: "guidance",
      acolyteOfNatureSkill: "nature",
    },
  });
}

describe("Acolyte of Nature (Cleric Nature Domain)", () => {
  it("derives cantrip and skill grant feature rows", () => {
    const data = clericNatureCharacter();
    const grants = deriveGrantConfigurableFeatures(data, { classes: PHB_CLASSES });
    const names = grants.map((g) => g.name);
    assert.ok(names.includes("Acolyte of Nature — Cantrip"));
    assert.ok(names.includes("Acolyte of Nature — Skill"));
  });

  it("grants skill proficiency and druid cantrip when choices are set", () => {
    const data = clericNatureCharacter();
    const catalogs = { classes: PHB_CLASSES };

    const skillGrants = resolveAllSkillGrants(data, catalogs);
    assert.ok(
      skillGrants.some(
        (g) =>
          g.grantKey === "grant:subclass:acolyte-of-nature-skill" &&
          g.skills.includes("nature")
      )
    );

    const spellGrants = resolveAllSpellGrants(data, catalogs);
    assert.ok(
      spellGrants.some(
        (g) =>
          g.grantKey === "grant:subclass:acolyte-of-nature-cantrip" &&
          g.spellId === "guidance"
      )
    );
  });
});
