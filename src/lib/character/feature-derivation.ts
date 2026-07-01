import type { CharacterData, Feature } from "@/lib/schemas/character";
import { resolveCharacterClass } from "@/lib/character/class-derivation";
import {
  catalogFeatureId,
  parseCatalogFeatureEntry,
  type CatalogFeatureEntry,
  type CatalogFeatureMechanics,
} from "@/lib/dnd/catalog-feature-mechanics";
import {
  findBackgroundByName,
  findSpeciesByDisplayName,
  findSubclassByName,
} from "@/lib/content/catalog-tooltip";
import {
  deriveConfigurableFeatures,
  isLegacyPersonalizedFeature,
  resolveFeatureCatalogs,
  type ConfigurableGrantedFeature,
  type FeatureCatalogs,
  type FeatureSource,
} from "@/lib/character/feature-choices";
import {
  deriveGrantConfigurableFeatures,
  isGrantConfigurableFeature,
  isReplacedByGrantFeature,
  type GrantConfigurableFeature,
} from "@/lib/character/feature-grant-features";
import { getSpellcastingFeatureDescription } from "@/lib/dnd/spellcasting";
import { levelFromXp } from "@/lib/dnd/xp";

export type { FeatureCatalogs, FeatureSource, ConfigurableGrantedFeature };
export { isConfigurableGrantedFeature, isLegacyPersonalizedFeature } from "@/lib/character/feature-choices";
export {
  isGrantConfigurableFeature,
  type GrantConfigurableFeature,
} from "@/lib/character/feature-grant-features";
export { enrichMechanicalFeature } from "@/lib/dnd/mechanical-features";

export interface GrantedFeature extends Feature {
  source: FeatureSource;
  locked: true;
  catalogMechanics?: CatalogFeatureMechanics;
}

export type DerivedFeature = GrantedFeature | ConfigurableGrantedFeature;

/** Generic class features replaced by personalized creator choices. */
export const CREATOR_OVERRIDDEN_CLASS_FEATURES: Partial<
  Record<string, readonly string[]>
> = {
  ranger: ["Favored Enemy", "Natural Explorer"],
  fighter: ["Fighting Style"],
};

export function isOverriddenClassFeature(
  classId: string,
  featureName: string
): boolean {
  return (
    CREATOR_OVERRIDDEN_CLASS_FEATURES[classId]?.includes(featureName) ?? false
  );
}

export function isFeatureAvailableAtLevel(
  entry: CatalogFeatureEntry | { name: string; description: string },
  characterLevel: number
): boolean {
  const parsed = parseCatalogFeatureEntry(entry);
  const minLevel = parsed?.minLevel;
  if (minLevel == null) return true;
  return characterLevel >= minLevel;
}

function makeGrantedFeature(
  source: FeatureSource,
  entry: CatalogFeatureEntry | { name: string; description: string },
  restReset: Feature["restReset"] = "none"
): GrantedFeature {
  const parsed = parseCatalogFeatureEntry(entry) ?? {
    name: entry.name,
    description: entry.description,
  };
  const mechanics = parsed.mechanics;
  return {
    id: catalogFeatureId(source, parsed),
    name: parsed.name,
    description: parsed.description,
    usesAction:
      mechanics?.kind === "action-only" || (mechanics?.usesAction ?? false),
    actionCost:
      mechanics?.kind === "action-only"
        ? mechanics.actionCost
        : mechanics?.actionCost ?? "action",
    restReset:
      mechanics?.kind === "uses" || mechanics?.kind === "hp-pool"
        ? mechanics.restReset
        : restReset,
    catalogMechanics: mechanics,
    source,
    locked: true,
  };
}

/** Derive a display name from subspecies extra text (e.g. "Tinker: …" → "Tinker"). */
function subspeciesExtraFeatureName(text: string, subspeciesName: string, index: number): string {
  const colonIdx = text.indexOf(":");
  if (colonIdx > 0) {
    return text.slice(0, colonIdx).trim();
  }
  const trimmed = text.trim().replace(/\.$/, "");
  if (trimmed.length > 0 && trimmed.length <= 80) return trimmed;
  return `${subspeciesName} (${index + 1})`;
}

/** Rules-derived features from species, class, subclass, and background. */
export function deriveGrantedFeatures(
  data: CharacterData,
  catalogs: FeatureCatalogs = {}
): DerivedFeature[] {
  const { species: speciesList, classes, backgrounds } = resolveFeatureCatalogs(catalogs);
  const features: DerivedFeature[] = [];

  const speciesMatch = findSpeciesByDisplayName(data.basicInfo.species, speciesList);
  const species = speciesMatch?.species;
  const subspecies = speciesMatch?.subspecies;

  const cls = resolveCharacterClass(data, classes);
  const className =
    data.basicInfo.classes[0] ?? data.basicInfo.class ?? cls?.name ?? "";
  const subclassMatch = findSubclassByName(
    className,
    data.basicInfo.subclass,
    classes
  );
  const sub = subclassMatch?.subclass;

  const background = findBackgroundByName(data.basicInfo.background, backgrounds);
  const characterLevel = levelFromXp(data.basicInfo.xp ?? 0);

  species?.traits.forEach((t) => {
    if (species.id === "warforged" && t.name === "Integrated Protection") return;
    features.push(makeGrantedFeature("species", t));
  });

  subspecies?.extras?.forEach((text, index) => {
    features.push(
      makeGrantedFeature("species", {
        name: subspeciesExtraFeatureName(text, subspecies.name, index),
        description: text,
      })
    );
  });

  if (species?.id === "warforged") {
    features.push(
      makeGrantedFeature("species", {
        name: "Integrated Protection",
        description: "+1 bonus to Armor Class (included in your AC).",
      })
    );
  }

  cls?.features.forEach((f) => {
    if (isOverriddenClassFeature(cls.id, f.name)) return;
    if (!isFeatureAvailableAtLevel(f, characterLevel)) return;
    features.push(makeGrantedFeature("class", f, "long"));
  });

  if (cls?.spellcasting) {
    const spellcastingDesc = getSpellcastingFeatureDescription(cls);
    const existingIdx = features.findIndex(
      (f) => f.locked && f.source === "class" && f.name === "Spellcasting"
    );
    if (existingIdx >= 0) {
      const existing = features[existingIdx] as GrantedFeature;
      features[existingIdx] = { ...existing, description: spellcastingDesc };
    } else {
      features.push(
        makeGrantedFeature(
          "class",
          {
            name: "Spellcasting",
            slug: "spellcasting",
            description: spellcastingDesc,
          },
          "long"
        )
      );
    }
  }

  features.push(...deriveConfigurableFeatures(data, catalogs));
  features.push(...deriveGrantConfigurableFeatures(data, catalogs));

  sub?.features.forEach((f) => {
    if (!isFeatureAvailableAtLevel(f, characterLevel)) return;
    features.push(makeGrantedFeature("subclass", f, "long"));
  });

  if (background) {
    features.push(makeGrantedFeature("background", background.feature));
  }

  const grantFeatures = features.filter(
    (f): f is GrantConfigurableFeature => isGrantConfigurableFeature(f)
  );
  return features.filter(
    (f) =>
      !f.locked ||
      !isReplacedByGrantFeature(f as GrantedFeature, grantFeatures)
  );
}

const FEATURE_SOURCE_LABEL: Record<FeatureSource, string> = {
  species: "Species",
  class: "Class",
  subclass: "Subclass",
  background: "Background",
};

export function featureSourceLabel(source: FeatureSource): string {
  return FEATURE_SOURCE_LABEL[source];
}

/** Whether a stored feature is a player-added custom entry. */
export function isCustomFeature(
  feature: Feature,
  granted: DerivedFeature[]
): boolean {
  if (isLegacyPersonalizedFeature(feature)) return false;

  const grantedIds = new Set(granted.map((g) => g.id));
  if (grantedIds.has(feature.id)) return false;

  const grantedNames = new Set(
    granted.filter((g) => g.locked).map((g) => g.name.toLowerCase())
  );
  return !grantedNames.has(feature.name.toLowerCase());
}

/** Stored features that are not rules-derived. */
export function getCustomFeatures(
  data: CharacterData,
  catalogs?: FeatureCatalogs
): Feature[] {
  const granted = deriveGrantedFeatures(data, catalogs);
  return data.features.filter((f) => isCustomFeature(f, granted));
}

export function getAllCharacterFeatures(
  data: CharacterData,
  catalogs?: FeatureCatalogs
): Array<DerivedFeature | Feature> {
  return [...deriveGrantedFeatures(data, catalogs), ...getCustomFeatures(data, catalogs)];
}

/** Drop legacy copies of granted features before persisting. */
export function stripGrantedFeaturesForSave(
  data: CharacterData,
  catalogs?: FeatureCatalogs
): CharacterData {
  return {
    ...data,
    features: getCustomFeatures(data, catalogs),
  };
}
