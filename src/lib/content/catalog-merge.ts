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
  const dbKeys = new Set(dbEntries.map((entry) => featureKey(entry)));

  const merged = dbEntries.map((entry) => {
    const phb = phbByKey.get(featureKey(entry));
    if (!phb) return entry;

    return {
      ...entry,
      slug: entry.slug?.trim() ? entry.slug : phb.slug,
      mechanics: entry.mechanics ?? phb.mechanics,
      minLevel: phb.minLevel ?? entry.minLevel,
    };
  });

  for (const phb of phbEntries) {
    if (!dbKeys.has(featureKey(phb))) {
      merged.push(phb);
    }
  }

  return merged;
}

export function mergeClassWithPhb(dbClass: PhbClass, phbClass: PhbClass | undefined): PhbClass {
  if (!phbClass) return dbClass;

  return {
    ...phbClass,
    ...dbClass,
    id: dbClass.id,
    name: dbClass.name,
    hitDie: dbClass.hitDie ?? phbClass.hitDie,
    savingThrows:
      dbClass.savingThrows?.length > 0 ? dbClass.savingThrows : phbClass.savingThrows,
    skillChoiceCount: dbClass.skillChoiceCount ?? phbClass.skillChoiceCount,
    skillOptions:
      dbClass.skillOptions?.length > 0 ? dbClass.skillOptions : phbClass.skillOptions,
    armorProficiencies:
      dbClass.armorProficiencies?.length > 0
        ? dbClass.armorProficiencies
        : phbClass.armorProficiencies,
    weaponProficiencies:
      dbClass.weaponProficiencies?.length > 0
        ? dbClass.weaponProficiencies
        : phbClass.weaponProficiencies,
    startingGold: dbClass.startingGold ?? phbClass.startingGold,
    equipmentChoices:
      dbClass.equipmentChoices?.length > 0
        ? dbClass.equipmentChoices
        : phbClass.equipmentChoices,
    fixedEquipment:
      dbClass.fixedEquipment?.length > 0
        ? dbClass.fixedEquipment
        : phbClass.fixedEquipment,
    subclassLevel: dbClass.subclassLevel ?? phbClass.subclassLevel,
    spellcasting: dbClass.spellcasting ?? phbClass.spellcasting,
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

  const phbSubById = new Map((phbSpecies.subspecies ?? []).map((sub) => [sub.id, sub]));
  const dbSubIds = new Set((dbSpecies.subspecies ?? []).map((sub) => sub.id));

  const mergedSubspecies = (dbSpecies.subspecies ?? []).map((sub) => {
    const phbSub = phbSubById.get(sub.id);
    if (!phbSub) return sub;
    return {
      ...phbSub,
      ...sub,
      extras: sub.extras?.length ? sub.extras : phbSub.extras,
      weaponProficiencies: sub.weaponProficiencies?.length
        ? sub.weaponProficiencies
        : phbSub.weaponProficiencies,
      armorProficiencies: sub.armorProficiencies?.length
        ? sub.armorProficiencies
        : phbSub.armorProficiencies,
      abilityBonus: sub.abilityBonus ?? phbSub.abilityBonus,
    };
  });

  for (const phbSub of phbSpecies.subspecies ?? []) {
    if (!dbSubIds.has(phbSub.id)) {
      mergedSubspecies.push(phbSub);
    }
  }

  return {
    ...phbSpecies,
    ...dbSpecies,
    id: dbSpecies.id,
    name: dbSpecies.name,
    traits: mergeCatalogFeatureEntries(dbSpecies.traits, phbSpecies.traits),
    subspecies: mergedSubspecies.length ? mergedSubspecies : phbSpecies.subspecies,
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
