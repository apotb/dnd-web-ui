import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveGrantedFeatures, getSpeciesTooltipFeatures, getTooltipClassFeatures, getUnlockedCatalogFeatures, featureFamilyKey } from "@/lib/character/feature-derivation";
import { formatSpeciesTooltip } from "@/lib/content/catalog-tooltip";
import { migrateFeatureChoices } from "@/lib/character/feature-choices";
import { PHB_CLASSES } from "@/lib/dnd/phb/classes";
import { PHB_SPECIES } from "@/lib/dnd/phb/species";
import { createDefaultCharacterData } from "@/lib/schemas/character";

const catalogs = { classes: PHB_CLASSES, species: PHB_SPECIES };

function wizard(xp: number) {
  return createDefaultCharacterData({
    basicInfo: {
      class: "Wizard",
      classes: ["Wizard"],
      subclass: "",
      xp,
    },
  });
}

describe("deriveGrantedFeatures level gates", () => {
  it("omits Arcane Recovery for level 1 wizards", () => {
    const features = deriveGrantedFeatures(wizard(0), catalogs);
    assert.equal(
      features.some((feature) => feature.name === "Arcane Recovery"),
      false
    );
  });

  it("includes Arcane Recovery for level 2 wizards", () => {
    const features = deriveGrantedFeatures(
      createDefaultCharacterData({
        basicInfo: {
          class: "Wizard",
          classes: ["Wizard"],
          subclass: "",
          level: 2,
          xp: 300,
        },
      }),
      catalogs
    );
    const arcaneRecovery = features.find(
      (feature) => feature.name === "Arcane Recovery"
    );
    assert.ok(arcaneRecovery);
    assert.equal(arcaneRecovery!.source, "class");
  });

  it("shows only the latest bardic inspiration upgrade on the sheet", () => {
    const data = createDefaultCharacterData({
      basicInfo: {
        class: "Bard",
        classes: ["Bard"],
        subclass: "",
        level: 10,
        xp: 64000,
      },
    });
    const features = deriveGrantedFeatures(data, catalogs);
    const inspiration = features.filter((f) =>
      f.name.toLowerCase().startsWith("bardic inspiration")
    );
    assert.equal(inspiration.length, 1);
    assert.ok(inspiration[0]!.name.includes("d10"));
  });
});

describe("getUnlockedCatalogFeatures", () => {
  it("normalizes unicode whitespace in feature family keys", () => {
    assert.equal(
      featureFamilyKey("Natural\u202fExplorer"),
      featureFamilyKey("Natural Explorer")
    );
  });

  it("filters class features to the current level", () => {
    const wizard = PHB_CLASSES.find((c) => c.id === "wizard")!;
    const atLevel1 = getUnlockedCatalogFeatures(wizard.features, 1, wizard.id);
    const atLevel2 = getUnlockedCatalogFeatures(wizard.features, 2, wizard.id);
    assert.equal(
      atLevel1.some((f) => f.name === "Arcane Recovery"),
      false
    );
    assert.equal(
      atLevel2.some((f) => f.name === "Arcane Recovery"),
      true
    );
    assert.ok(atLevel2.length > atLevel1.length);
  });
});

describe("featureFamilyKey", () => {
  it("groups fighting style variants under one family", () => {
    assert.equal(featureFamilyKey("Fighting Style"), "fighting style");
    assert.equal(featureFamilyKey("Fighting Style: Defense"), "fighting style");
    assert.equal(featureFamilyKey("Fighting Style: Archery"), "fighting style");
  });
});

describe("getTooltipClassFeatures", () => {
  it("includes level-1 features hidden from the sheet by override rules", () => {
    const fighter = PHB_CLASSES.find((c) => c.id === "fighter")!;
    const sheet = getUnlockedCatalogFeatures(fighter.features, 1, fighter.id);
    const tooltip = getTooltipClassFeatures(fighter, 1);
    assert.equal(sheet.some((f) => f.name === "Fighting Style"), false);
    assert.equal(tooltip.some((f) => f.name === "Fighting Style"), true);
    assert.equal(tooltip.some((f) => f.name === "Second Wind"), true);
  });

  it("includes ranger favored enemy at level 1", () => {
    const ranger = PHB_CLASSES.find((c) => c.id === "ranger")!;
    const tooltip = getTooltipClassFeatures(ranger, 1);
    assert.equal(
      tooltip.some((f) => f.name.startsWith("Favored Enemy")),
      true
    );
    assert.equal(
      tooltip.some((f) => f.name.startsWith("Natural Explorer")),
      true
    );
  });

  it("adds spellcasting for wizards at level 1", () => {
    const wizard = PHB_CLASSES.find((c) => c.id === "wizard")!;
    const tooltip = getTooltipClassFeatures(wizard, 1);
    assert.equal(tooltip.some((f) => f.name === "Spellcasting"), true);
    assert.equal(tooltip.some((f) => f.name === "Ritual Casting"), true);
  });
});

describe("deriveGrantedFeatures ranger favorites", () => {
  function ranger(xp: number, level?: number) {
    return createDefaultCharacterData({
      basicInfo: {
        class: "Ranger",
        classes: ["Ranger"],
        subclass: "",
        level: level ?? 1,
        xp,
      },
    });
  }

  it("shows one editable Favored Enemy and Natural Explorer without locked duplicates at level 1", () => {
    const features = deriveGrantedFeatures(ranger(0), catalogs);
    const favoredEnemy = features.filter((f) =>
      f.name.toLowerCase().startsWith("favored enemy")
    );
    const naturalExplorer = features.filter((f) =>
      f.name.toLowerCase().startsWith("natural explorer")
    );
    assert.equal(favoredEnemy.length, 1);
    assert.equal(naturalExplorer.length, 1);
    assert.equal(favoredEnemy[0]!.locked, false);
    assert.equal(naturalExplorer[0]!.locked, false);
    assert.equal(favoredEnemy[0]!.name, "Favored Enemy");
  });

  it("omits locked favored enemy family rows at level 6 and 14", () => {
    for (const level of [6, 14]) {
      const xp = level === 6 ? 2300 : 115000;
      const features = deriveGrantedFeatures(ranger(xp, level), catalogs);
      assert.equal(
        features.some((f) => f.locked && f.name.includes("Favored Enemy")),
        false
      );
      assert.equal(
        features.some((f) => f.locked && f.name.includes("Natural Explorer")),
        false
      );
    }
  });
});

describe("getUnlockedCatalogFeatures ranger overrides", () => {
  it("excludes favored enemy and natural explorer families for ranger", () => {
    const rangerClass = PHB_CLASSES.find((c) => c.id === "ranger")!;
    const unlocked = getUnlockedCatalogFeatures(rangerClass.features, 14, "ranger");
    assert.equal(
      unlocked.some((f) => f.name.toLowerCase().includes("favored enemy")),
      false
    );
    assert.equal(
      unlocked.some((f) => f.name.toLowerCase().includes("natural explorer")),
      false
    );
    assert.ok(unlocked.some((f) => f.name === "Extra Attack"));
  });
});

describe("deriveGrantedFeatures paladin fighting style", () => {
  it("level 2 paladin has one configurable fighting style without locked duplicate", () => {
    const features = deriveGrantedFeatures(
      createDefaultCharacterData({
        basicInfo: {
          class: "Paladin",
          classes: ["Paladin"],
          level: 2,
          xp: 300,
        },
        featureChoices: { fightingStyle: "Defense" },
      }),
      catalogs
    );
    const fightingStyles = features.filter((f) =>
      f.name.toLowerCase().includes("fighting style")
    );
    assert.equal(fightingStyles.length, 1);
    assert.equal(fightingStyles[0]!.locked, false);
    assert.equal(fightingStyles[0]!.name, "Fighting Style: Defense");
    assert.equal("choiceKey" in fightingStyles[0]!, true);
  });
});

describe("migrateFeatureChoices ranger arrays", () => {
  it("migrates legacy single favored enemy and terrain into arrays", () => {
    const data = createDefaultCharacterData({
      featureChoices: {
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
    });
    const migrated = migrateFeatureChoices(data);
    assert.equal(migrated.featureChoices?.favoredEnemyPicks[0]?.enemy, "Beasts");
    assert.equal(migrated.featureChoices?.favoredTerrains[0], "Forest");
  });
});

describe("getSpeciesTooltipFeatures", () => {
  it("formats rock gnome subspecies extras as named features", () => {
    const gnome = PHB_SPECIES.find((s) => s.id === "gnome")!;
    const rock = gnome.subspecies?.find((s) => s.id === "rock");
    assert.ok(rock);

    const features = getSpeciesTooltipFeatures(gnome, rock);
    const lore = features.find((f) => f.name === "Artificer's Lore");
    const tinker = features.find((f) => f.name === "Tinker");

    assert.ok(lore);
    assert.ok(tinker);
    assert.equal(lore!.description.startsWith("Artificer's Lore"), false);
    assert.equal(tinker!.description.startsWith("Tinker"), false);
    assert.match(lore!.description, /History/i);
    assert.match(tinker!.description, /clockwork/i);
  });

  it("matches formatSpeciesTooltip output for rock gnome", () => {
    const gnome = PHB_SPECIES.find((s) => s.id === "gnome")!;
    const rock = gnome.subspecies?.find((s) => s.id === "rock");
    const tooltip = formatSpeciesTooltip(gnome, rock);
    assert.ok(tooltip);
    assert.match(tooltip!, /Artificer's Lore\n/);
    assert.match(tooltip!, /Tinker\n/);
    assert.doesNotMatch(tooltip!, /Artificer's Lore:/);
  });
});

describe("deriveGrantedFeatures subspecies extras", () => {
  it("strips duplicated titles from colon-prefixed rock gnome extras", () => {
    const features = deriveGrantedFeatures(
      createDefaultCharacterData({
        basicInfo: { species: "Gnome (Rock Gnome)" },
      }),
      catalogs
    );
    const tinker = features.find((f) => f.name === "Tinker");
    const lore = features.find((f) => f.name === "Artificer's Lore");
    assert.ok(tinker);
    assert.ok(lore);
    assert.equal(tinker!.description.startsWith("Tinker"), false);
    assert.equal(lore!.description.startsWith("Artificer's Lore"), false);
    assert.match(tinker!.description, /clockwork/i);
    assert.match(lore!.description, /History/i);
  });
});

describe("deriveGrantedFeatures feats", () => {
  it("does not include level-up feats in the granted features list", () => {
    const features = deriveGrantedFeatures(
      createDefaultCharacterData({
        levelUpFeats: { "4": "alert" },
      }),
      catalogs
    );
    assert.equal(features.some((f) => f.name === "Alert"), false);
  });
});
