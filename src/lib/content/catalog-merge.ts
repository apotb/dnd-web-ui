import {
  slugifyFeatureName,
  type CatalogFeatureEntry,
} from "@/lib/dnd/catalog-feature-mechanics";
import type { PhbClass, PhbSpecies } from "@/lib/dnd/phb/types";

function featureKey(entry: Pick<CatalogFeatureEntry, "name" | "slug">): string {
  return entry.slug?.trim() || slugifyFeatureName(entry.name);
}

export function mergeCatalogFeatureEntries(
  dbEntries: CatalogFeatureEntry[],
  phbEntries: CatalogFeatureEntry[]
): CatalogFeatureEntry[] {
  const phbByKey = new Map(phbEntries.map((entry) => [featureKey(entry), entry]));

  return dbEntries.map((entry) => {
    const phb = phbByKey.get(featureKey(entry));
    if (!phb) return entry;

    return {
      ...entry,
      slug: entry.slug?.trim() ? entry.slug : phb.slug,
      mechanics: entry.mechanics ?? phb.mechanics,
    };
  });
}

export function mergeClassWithPhb(dbClass: PhbClass, phbClass: PhbClass | undefined): PhbClass {
  if (!phbClass) return dbClass;

  return {
    ...dbClass,
    features: mergeCatalogFeatureEntries(dbClass.features, phbClass.features),
    subclasses: dbClass.subclasses.map((subclass) => {
      const phbSubclass = phbClass.subclasses.find((entry) => entry.id === subclass.id);
      if (!phbSubclass) return subclass;

      return {
        ...subclass,
        features: mergeCatalogFeatureEntries(subclass.features, phbSubclass.features),
      };
    }),
  };
}

export function mergeSpeciesWithPhb(
  dbSpecies: PhbSpecies,
  phbSpecies: PhbSpecies | undefined
): PhbSpecies {
  if (!phbSpecies) return dbSpecies;

  return {
    ...dbSpecies,
    traits: mergeCatalogFeatureEntries(dbSpecies.traits, phbSpecies.traits),
  };
}

export function mergeClassesWithPhb(
  dbClasses: PhbClass[],
  phbClasses: PhbClass[]
): PhbClass[] {
  const phbById = new Map(phbClasses.map((entry) => [entry.id, entry]));
  return dbClasses.map((entry) => mergeClassWithPhb(entry, phbById.get(entry.id)));
}

export function mergeSpeciesListWithPhb(
  dbSpecies: PhbSpecies[],
  phbSpecies: PhbSpecies[]
): PhbSpecies[] {
  const phbById = new Map(phbSpecies.map((entry) => [entry.id, entry]));
  return dbSpecies.map((entry) => mergeSpeciesWithPhb(entry, phbById.get(entry.id)));
}
