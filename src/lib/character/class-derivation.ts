import type { AbilityKey, CharacterData } from "@/lib/schemas/character";
import { PHB_CLASSES } from "@/lib/dnd/phb/classes";
import type { PhbClass } from "@/lib/dnd/phb/types";

/** Resolve the character's primary class from stored labels (name or id). */
export function resolveCharacterClass(
  data: CharacterData,
  catalogClasses?: PhbClass[]
): PhbClass | undefined {
  const pool = catalogClasses?.length ? catalogClasses : PHB_CLASSES;
  const labels = data.basicInfo.classes.length
    ? data.basicInfo.classes
    : data.basicInfo.class
      ? [data.basicInfo.class]
      : [];
  if (!labels.length) return undefined;

  const raw = labels[0].trim();
  const lower = raw.toLowerCase();
  return pool.find((c) => c.id === raw || c.name.toLowerCase() === lower);
}

/** Class-granted saving throw proficiencies (two abilities per class). */
export function getClassSavingThrowKeys(
  data: CharacterData,
  catalogClasses?: PhbClass[]
): AbilityKey[] {
  return resolveCharacterClass(data, catalogClasses)?.savingThrows ?? [];
}

export function isClassSavingThrowProficient(
  data: CharacterData,
  ability: AbilityKey,
  catalogClasses?: PhbClass[]
): boolean {
  const keys = getClassSavingThrowKeys(data, catalogClasses);
  if (keys.length > 0) return keys.includes(ability);
  return data.savingThrows[ability]?.proficient ?? false;
}

/** Rebuild savingThrows from class — used on load/save so JSON matches rules. */
export function syncSavingThrowsFromClass(
  data: CharacterData,
  catalogClasses?: PhbClass[]
): CharacterData["savingThrows"] {
  const keys = getClassSavingThrowKeys(data, catalogClasses);
  const savingThrows: CharacterData["savingThrows"] = {};
  for (const key of keys) {
    savingThrows[key] = { proficient: true };
  }
  return savingThrows;
}

function mergeProficiencyLists(...lists: (string[] | undefined)[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const list of lists) {
    for (const entry of list ?? []) {
      const key = entry.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(entry);
    }
  }
  return merged;
}

/** Stored proficiencies plus class-granted weapon proficiencies. */
export function getEffectiveWeaponProficiencies(
  data: CharacterData,
  catalogClasses?: PhbClass[]
): string[] {
  const cls = resolveCharacterClass(data, catalogClasses);
  return mergeProficiencyLists(data.weaponProficiencies, cls?.weaponProficiencies);
}

/** Stored proficiencies plus class-granted armor proficiencies. */
export function getEffectiveArmorProficiencies(
  data: CharacterData,
  catalogClasses?: PhbClass[]
): string[] {
  const cls = resolveCharacterClass(data, catalogClasses);
  return mergeProficiencyLists(data.armorProficiencies, cls?.armorProficiencies);
}
