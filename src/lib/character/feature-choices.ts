import type { CharacterData, Feature, FeatureChoices } from "@/lib/schemas/character";
import { resolveCharacterClass } from "@/lib/character/class-derivation";
import {
  featureFamilyKey,
  isFeatureAvailableAtLevel,
} from "@/lib/character/feature-derivation";
import {
  FAVORED_ENEMIES,
  FAVORED_TERRAINS,
} from "@/lib/dnd/phb/classes";
import {
  getFightingStyleOptions,
  hasFightingStyleAtLevel,
} from "@/lib/dnd/phb/fighting-styles";
import {
  formatFavoredEnemyDisplay,
  parseFavoredEnemyLegacy,
} from "@/lib/dnd/phb/favored-enemy-humanoids";
import type { CatalogFeatureEntry } from "@/lib/dnd/catalog-feature-mechanics";
import { parseCatalogFeatureEntry } from "@/lib/dnd/catalog-feature-mechanics";
import {
  getRangerPicksFromChoices,
  type FavoredEnemyPick,
} from "@/lib/dnd/phb/ranger-feature-slots";
import { getCharacterLevel } from "@/lib/dnd/xp";
import { getFeat, PHB_FEATS } from "@/lib/dnd/phb/feats";
import { ALL_BACKGROUNDS } from "@/lib/dnd/phb/backgrounds";
import { PHB_CLASSES } from "@/lib/dnd/phb/classes";
import { ALL_SPECIES } from "@/lib/dnd/phb/species";
import type { PhbBackground, PhbClass, PhbSpecies, PhbSubclass } from "@/lib/dnd/phb/types";

export type FeatureSource = "species" | "class" | "subclass" | "background";

export interface FeatureCatalogs {
  species?: PhbSpecies[];
  classes?: PhbClass[];
  backgrounds?: PhbBackground[];
}

export type FeatureChoiceKey = keyof FeatureChoices;

export type ChoiceOption = { value: string; label: string; description?: string };

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

/** Rules text for a specific fighting style from class catalog entries. */
export function findFightingStyleDescription(
  classFeatures: PhbClass["features"],
  styleName: string
): string | undefined {
  if (!styleName.trim()) return undefined;
  const target = `Fighting Style: ${styleName}`;
  const entry = classFeatures.find((f) => f.name.toLowerCase() === target.toLowerCase());
  return entry?.description?.trim() || undefined;
}

/** Lookup fighting style description across PHB classes (fallback when class unknown). */
export function findFightingStyleDescriptionAny(styleName: string): string | undefined {
  for (const cls of PHB_CLASSES) {
    const description = findFightingStyleDescription(cls.features, styleName);
    if (description) return description;
  }
  return undefined;
}

export function buildFightingStyleChoiceOptions(
  classFeatures: PhbClass["features"],
  styleNames: readonly string[]
): ChoiceOption[] {
  return styleNames.map((name) => ({
    value: name,
    label: name,
    description: findFightingStyleDescription(classFeatures, name),
  }));
}

/** Card-picker label for a subclass (shortens wizard arcane tradition names). */
export function formatSubclassPickerLabel(name: string): string {
  return name.replace(/^Arcane Tradition:\s*/i, "").trim();
}

/** Summarize subclass features gained at or before the pick level. */
export function formatSubclassPickerDescription(
  features: CatalogFeatureEntry[],
  targetLevel: number
): string | undefined {
  const lines = features
    .filter((feature) => (feature.minLevel ?? 1) <= targetLevel)
    .map((feature) => {
      const description = feature.description?.trim();
      if (description) return `${feature.name} — ${description}`;
      return feature.name;
    });
  return lines.length > 0 ? lines.join("\n\n") : undefined;
}

export function buildSubclassChoiceOptions(
  subclasses: readonly PhbSubclass[],
  targetLevel: number
): ChoiceOption[] {
  return subclasses.map((subclass) => ({
    value: subclass.id,
    label: formatSubclassPickerLabel(subclass.name),
    description: formatSubclassPickerDescription(subclass.features, targetLevel),
  }));
}

export function fightingStyleDisplayDescription(
  classFeatures: PhbClass["features"],
  rules: string,
  styleName: string
): string {
  if (!styleName.trim()) return rules;
  return findFightingStyleDescription(classFeatures, styleName) ?? `${styleName} fighting style.`;
}

/** Sheet/review title for the fighting style class feature. */
export function fightingStyleFeatureName(styleName: string): string {
  const trimmed = styleName.trim();
  return trimmed ? `Fighting Style: ${trimmed}` : "Fighting Style";
}

export function selectedChoiceDescription(
  options: readonly ChoiceOption[],
  value: string | undefined
): string | undefined {
  if (!value) return undefined;
  return options.find((option) => option.value === value)?.description;
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

export function findCatalogRulesDescription(
  features: PhbClass["features"],
  familyName: string,
  characterLevel: number
): string | undefined {
  const family = featureFamilyKey(familyName);
  const matches = features.filter(
    (entry) => featureFamilyKey(entry.name) === family && entry.description?.trim()
  );
  const atLevel = matches.filter((entry) => isFeatureAvailableAtLevel(entry, characterLevel));
  const sorted = [...atLevel].sort((a, b) => {
    const aLevel = parseCatalogFeatureEntry(a)?.minLevel ?? 0;
    const bLevel = parseCatalogFeatureEntry(b)?.minLevel ?? 0;
    if (bLevel !== aLevel) return bLevel - aLevel;
    return (b.description?.length ?? 0) - (a.description?.length ?? 0);
  });
  return sorted[0]?.description;
}

function formatFavoredEnemyPicksDisplay(picks: FavoredEnemyPick[]): string | null {
  const filled = picks.filter((pick) => pick.enemy.trim());
  if (filled.length === 0) return null;
  return filled
    .map((pick, index) => {
      const label = formatFavoredEnemyDisplay(pick.enemy, pick.humanoidSpecies);
      return filled.length > 1 ? `${index + 1}. ${label}` : label;
    })
    .join("\n");
}

function formatFavoredTerrainsDisplay(terrains: string[]): string | null {
  const filled = terrains.filter((terrain) => terrain.trim());
  if (filled.length === 0) return null;
  return filled
    .map((terrain, index) => (filled.length > 1 ? `${index + 1}. ${terrain}` : terrain))
    .join("\n");
}

function migrateRangerPickArrays(choices: FeatureChoices): FeatureChoices {
  const next = { ...choices };
  if ((!next.favoredEnemyPicks || next.favoredEnemyPicks.length === 0) && next.favoredEnemy) {
    next.favoredEnemyPicks = [
      {
        enemy: next.favoredEnemy,
        humanoidSpecies: next.favoredHumanoidSpecies ?? [],
      },
    ];
  }
  if ((!next.favoredTerrains || next.favoredTerrains.length === 0) && next.favoredTerrain) {
    next.favoredTerrains = [next.favoredTerrain];
  }
  return next;
}

export function choicePlaceholder(key: FeatureChoiceKey): string {
  switch (key) {
    case "favoredEnemy":
      return "Select enemy";
    case "favoredTerrain":
      return "Select terrain";
    case "fightingStyle":
      return "Select fighting style";
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
  const { classes } = resolveCatalogs(catalogs);
  const choices = data.featureChoices ?? {};
  const cls = resolveCharacterClass(data, classes);
  const features: ConfigurableGrantedFeature[] = [];
  const characterLevel = getCharacterLevel(data);

  if (cls && hasFightingStyleAtLevel(cls.id, characterLevel)) {
    const rules =
      findCatalogRulesDescription(cls.features, "Fighting Style", characterLevel) ??
      cls.features.find((f) => f.name === "Fighting Style")?.description ??
      "Choose a fighting style.";
    const style = choices.fightingStyle ?? "";
    const styleOptions = getFightingStyleOptions(cls.id);
    features.push(
      makeConfigurableFeature(
        "class",
        fightingStyleFeatureName(style),
        rules,
        "fightingStyle",
        style,
        buildFightingStyleChoiceOptions(cls.features, styleOptions),
        fightingStyleDisplayDescription(cls.features, rules, style)
      )
    );
  }

  if (cls?.id === "ranger") {
    const { enemyPicks, terrains } = getRangerPicksFromChoices(choices, characterLevel);
    const enemyRules =
      findCatalogRulesDescription(cls.features, "Favored Enemy", characterLevel) ??
      "Advantage on Survival checks to track and Intelligence to recall info about chosen enemy type.";
    const terrainRules =
      findCatalogRulesDescription(cls.features, "Natural Explorer", characterLevel) ??
      "Benefits in favored terrain.";
    const enemyDisplay = formatFavoredEnemyPicksDisplay(enemyPicks);
    const terrainDisplay = formatFavoredTerrainsDisplay(terrains);
    const primaryEnemy = enemyPicks[0]?.enemy ?? "";

    features.push(
      makeConfigurableFeature(
        "class",
        "Favored Enemy",
        enemyRules,
        "favoredEnemy",
        primaryEnemy,
        choiceOptions(FAVORED_ENEMIES),
        buildChoiceDescription(enemyRules, enemyDisplay)
      )
    );
    features.push(
      makeConfigurableFeature(
        "class",
        "Natural Explorer",
        terrainRules,
        "favoredTerrain",
        terrains[0] ?? "",
        choiceOptions(FAVORED_TERRAINS),
        buildChoiceDescription(terrainRules, terrainDisplay)
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

  return {
    ...data,
    featureChoices: migrateRangerPickArrays(choices),
    features,
  };
}

export function formatChoiceSummary(
  key: FeatureChoiceKey,
  value: string,
  rulesFallback: string
): string {
  if (!value) return rulesFallback;
  switch (key) {
    case "fightingStyle":
      return (
        findFightingStyleDescriptionAny(value) ?? `${value} fighting style.`
      );
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
