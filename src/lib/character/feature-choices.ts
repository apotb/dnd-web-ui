import type { CharacterData, Feature, FeatureChoices } from "@/lib/schemas/character";
import { findSpeciesByDisplayName } from "@/lib/content/catalog-tooltip";
import { resolveCharacterClass } from "@/lib/character/class-derivation";
import {
  FAVORED_ENEMIES,
  FAVORED_TERRAINS,
  FIGHTING_STYLES,
} from "@/lib/dnd/phb/classes";
import {
  formatFavoredEnemyDisplay,
  parseFavoredEnemyLegacy,
  TWO_HUMANOID_SPECIES_OPTION,
} from "@/lib/dnd/phb/favored-enemy-humanoids";
import { getFeat, PHB_FEATS } from "@/lib/dnd/phb/feats";
import { ALL_BACKGROUNDS } from "@/lib/dnd/phb/backgrounds";
import { PHB_CLASSES } from "@/lib/dnd/phb/classes";
import { ALL_SPECIES } from "@/lib/dnd/phb/species";
import type { PhbBackground, PhbClass, PhbSpecies } from "@/lib/dnd/phb/types";

export type FeatureSource = "species" | "class" | "subclass" | "background";

export interface FeatureCatalogs {
  species?: PhbSpecies[];
  classes?: PhbClass[];
  backgrounds?: PhbBackground[];
}

export type FeatureChoiceKey = keyof FeatureChoices;

export type ChoiceOption = { value: string; label: string };

export interface ConfigurableGrantedFeature {
  id: string;
  name: string;
  description: string;
  restReset: Feature["restReset"];
  source: FeatureSource;
  locked: false;
  choiceKey: FeatureChoiceKey;
  choiceValue: string;
  choiceOptions: ChoiceOption[];
}

export function isConfigurableGrantedFeature(
  feature: { locked?: boolean; choiceKey?: FeatureChoiceKey }
): feature is ConfigurableGrantedFeature {
  return feature.locked === false && !!feature.choiceKey;
}

export function isLegacyPersonalizedFeature(feature: Feature): boolean {
  if (/^Fighting Style:/i.test(feature.name)) return true;
  if (feature.name === "Favored Enemy" || feature.name === "Natural Explorer") {
    return true;
  }
  return false;
}

function choiceOptions(values: readonly string[]): ChoiceOption[] {
  return values.map((value) => ({ value, label: value }));
}

function featOptions(): ChoiceOption[] {
  return PHB_FEATS.map((f) => ({ value: f.id, label: f.name }));
}

export function resolveFeatureCatalogs(catalogs: FeatureCatalogs = {}) {
  return {
    species: catalogs.species?.length ? catalogs.species : ALL_SPECIES,
    classes: catalogs.classes?.length ? catalogs.classes : PHB_CLASSES,
    backgrounds: catalogs.backgrounds?.length ? catalogs.backgrounds : ALL_BACKGROUNDS,
  };
}

function resolveCatalogs(catalogs: FeatureCatalogs = {}) {
  return resolveFeatureCatalogs(catalogs);
}

export function buildChoiceDescription(rules: string, selection: string | null): string {
  if (!selection) return rules;
  return `${rules}\n\nSelected: ${selection}`;
}

export function choicePlaceholder(key: FeatureChoiceKey): string {
  switch (key) {
    case "favoredEnemy":
      return "Select enemy";
    case "favoredTerrain":
      return "Select terrain";
    default:
      return "Choose…";
  }
}
function makeConfigurableFeature(
  source: FeatureSource,
  name: string,
  rulesDescription: string,
  choiceKey: FeatureChoiceKey,
  choiceValue: string,
  choiceOptionsList: ChoiceOption[],
  displayDescription: string
): ConfigurableGrantedFeature {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    id: `choice:${source}:${choiceKey}:${slug}`,
    name,
    description: displayDescription,
    restReset: "none",
    source,
    locked: false,
    choiceKey,
    choiceValue,
    choiceOptions: choiceOptionsList,
  };
}

/** Build editable granted features from stored featureChoices + class/species. */
export function deriveConfigurableFeatures(
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): ConfigurableGrantedFeature[] {
  const { species, classes } = resolveCatalogs(catalogs);
  const choices = data.featureChoices ?? {};
  const cls = resolveCharacterClass(data, classes);
  const features: ConfigurableGrantedFeature[] = [];

  if (cls?.id === "fighter") {
    const rules =
      cls.features.find((f) => f.name === "Fighting Style")?.description ??
      "Choose a fighting style.";
    const style = choices.fightingStyle ?? "";
    features.push(
      makeConfigurableFeature(
        "class",
        "Fighting Style",
        rules,
        "fightingStyle",
        style,
        choiceOptions(FIGHTING_STYLES),
        style ? `${style} fighting style.` : rules
      )
    );
  }

  if (cls?.id === "ranger") {
    const enemyRules =
      cls.features.find((f) => f.name === "Favored Enemy")?.description ??
      "Advantage on Survival checks to track and Intelligence to recall info about chosen enemy type.";
    const terrainRules =
      cls.features.find((f) => f.name === "Natural Explorer")?.description ??
      "Benefits in favored terrain.";
    const enemy = choices.favoredEnemy ?? "";
    const humanoidSpecies = choices.favoredHumanoidSpecies ?? [];
    const terrain = choices.favoredTerrain ?? "";

    features.push(
      makeConfigurableFeature(
        "class",
        "Favored Enemy",
        enemyRules,
        "favoredEnemy",
        enemy,
        choiceOptions(FAVORED_ENEMIES),
        buildChoiceDescription(
          enemyRules,
          enemy ? formatFavoredEnemyDisplay(enemy, humanoidSpecies) : null
        )
      )
    );
    features.push(
      makeConfigurableFeature(
        "class",
        "Natural Explorer",
        terrainRules,
        "favoredTerrain",
        terrain,
        choiceOptions(FAVORED_TERRAINS),
        buildChoiceDescription(terrainRules, terrain || null)
      )
    );
  }

  const speciesMatch = findSpeciesByDisplayName(data.basicInfo.species, species);
  if (speciesMatch?.species.id === "human" && speciesMatch.subspecies?.id === "variant") {
    const featId = choices.variantHumanFeat ?? "";
    const feat = featId ? getFeat(featId) : null;
    features.push(
      makeConfigurableFeature(
        "species",
        feat?.name ?? "Feat",
        "Choose a feat (Variant Human).",
        "variantHumanFeat",
        featId,
        featOptions(),
        feat?.description ?? "Choose a feat (Variant Human)."
      )
    );
  }

  return features;
}

/** Pull legacy personalized features from `features[]` into featureChoices. */
export function migrateFeatureChoices(data: CharacterData): CharacterData {
  const choices: FeatureChoices = { ...(data.featureChoices ?? {}) };
  const removeIds = new Set<string>();

  for (const feature of data.features) {
    if (feature.name === "Favored Enemy" && feature.description && !choices.favoredEnemy) {
      const parsed = parseFavoredEnemyLegacy(feature.description);
      choices.favoredEnemy = parsed.enemy;
      choices.favoredHumanoidSpecies = parsed.humanoidSpeciesIds;
      removeIds.add(feature.id);
    }
    if (feature.name === "Natural Explorer" && !choices.favoredTerrain) {
      const match = feature.description.match(/^Favored terrain: (.+)$/);
      choices.favoredTerrain = match ? match[1] : feature.description;
      removeIds.add(feature.id);
    }
    const styleMatch = feature.name.match(/^Fighting Style: (.+)$/i);
    if (styleMatch && !choices.fightingStyle) {
      choices.fightingStyle = styleMatch[1];
      removeIds.add(feature.id);
    }
    if (!choices.variantHumanFeat) {
      const feat = PHB_FEATS.find((f) => f.name === feature.name);
      if (feat) {
        choices.variantHumanFeat = feat.id;
        removeIds.add(feature.id);
      }
    }
  }

  const features = data.features.filter(
    (f) => !isLegacyPersonalizedFeature(f) && !removeIds.has(f.id)
  );

  return { ...data, featureChoices: choices, features };
}

export function formatChoiceSummary(
  key: FeatureChoiceKey,
  value: string,
  rulesFallback: string
): string {
  if (!value) return rulesFallback;
  switch (key) {
    case "fightingStyle":
      return `${value} fighting style.`;
    case "favoredEnemy":
      return buildChoiceDescription(rulesFallback, formatFavoredEnemyDisplay(value, []));
    case "favoredTerrain":
      return buildChoiceDescription(rulesFallback, value);
    case "variantHumanFeat": {
      const feat = getFeat(value);
      return feat?.description ?? rulesFallback;
    }
    default:
      return rulesFallback;
  }
}
