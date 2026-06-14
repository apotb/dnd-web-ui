import { ABILITY_LABELS, SKILL_LABELS } from "@/lib/dnd/calculations";
import type {
  PhbBackground,
  PhbClass,
  PhbSpecies,
  PhbSubclass,
} from "@/lib/dnd/phb/types";
import type { AbilityKey, SkillKey } from "@/lib/schemas/character";
import {
  defaultLanguageLookup,
  resolveLanguageName,
  resolveLanguageSlug,
  type LanguageLookup,
} from "@/lib/languages/resolve";

type PhbSubspecies = NonNullable<PhbSpecies["subspecies"]>[number];

function uniqueLanguageNames(
  inputs: string[],
  lookup: LanguageLookup = defaultLanguageLookup()
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const input of inputs) {
    if (!input.trim()) continue;
    const slug = resolveLanguageSlug(input, lookup);
    if (seen.has(slug)) continue;
    seen.add(slug);
    names.push(resolveLanguageName(slug, lookup));
  }
  return names;
}

function formatSpeciesLanguagesLine(
  species: PhbSpecies,
  subspecies: PhbSubspecies | undefined,
  speciesLanguageChoices: string[] | undefined,
  lookup: LanguageLookup
): string | null {
  const parts = uniqueLanguageNames(
    [...species.languages, ...(species.fixedLanguages ?? [])],
    lookup
  );

  const choiceCount =
    (species.languageChoices ?? 0) + (subspecies?.id === "high" ? 1 : 0);

  if (speciesLanguageChoices?.length) {
    parts.push(...uniqueLanguageNames(speciesLanguageChoices, lookup));
  } else if (choiceCount > 0) {
    parts.push(
      choiceCount === 1
        ? "one language of your choice"
        : `${choiceCount} languages of your choice`
    );
  }

  return parts.length ? `Languages: ${parts.join(", ")}` : null;
}

function formatBackgroundLanguagesLine(
  bg: PhbBackground,
  backgroundLanguageChoices: string[] | undefined,
  lookup: LanguageLookup
): string | null {
  const parts = uniqueLanguageNames(bg.fixedLanguages ?? [], lookup);

  if (bg.languageChoices) {
    if (backgroundLanguageChoices?.length) {
      parts.push(...uniqueLanguageNames(backgroundLanguageChoices, lookup));
    } else {
      parts.push(
        bg.languageChoices === 1
          ? "one language of your choice"
          : `${bg.languageChoices} languages of your choice`
      );
    }
  }

  return parts.length ? `Languages: ${parts.join(", ")}` : null;
}

function joinLines(lines: string[]): string | null {
  const filtered = lines.filter(Boolean);
  return filtered.length > 0 ? filtered.join("\n\n") : null;
}

export function findSpeciesByDisplayName(
  displayName: string,
  speciesList: PhbSpecies[]
): { species: PhbSpecies; subspecies?: PhbSubspecies } | null {
  const normalized = displayName.trim().toLowerCase();
  if (!normalized) return null;

  for (const species of speciesList) {
    if (species.name.toLowerCase() === normalized) return { species };
    for (const subspecies of species.subspecies ?? []) {
      const composite = `${species.name} (${subspecies.name})`;
      if (composite.toLowerCase() === normalized) {
        return { species, subspecies };
      }
    }
  }

  return null;
}

/** Subtitle label: subspecies name when present, otherwise species name. */
export function speciesSubtitleLabel(
  displayName: string,
  speciesList: PhbSpecies[]
): string {
  const match = findSpeciesByDisplayName(displayName, speciesList);
  if (match?.subspecies) return match.subspecies.name;
  if (match?.species) return match.species.name;
  const trimmed = displayName.trim();
  const subspeciesFromParens = trimmed.match(/^(.+?)\s+\((.+)\)$/);
  if (subspeciesFromParens) return subspeciesFromParens[2].trim();
  return trimmed;
}

export function findBackgroundByName(
  name: string,
  backgrounds: PhbBackground[]
): PhbBackground | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  return backgrounds.find((b) => b.name.toLowerCase() === normalized) ?? null;
}

export function findClassByName(name: string, classes: PhbClass[]): PhbClass | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;
  return classes.find((c) => c.name.toLowerCase() === normalized) ?? null;
}

export function findSubclassByName(
  className: string,
  subclassName: string,
  classes: PhbClass[]
): { cls: PhbClass; subclass: PhbSubclass } | null {
  const cls = findClassByName(className, classes);
  if (!cls || !subclassName.trim()) return null;
  const normalized = subclassName.trim().toLowerCase();
  const subclass = cls.subclasses.find((s) => s.name.toLowerCase() === normalized);
  return subclass ? { cls, subclass } : null;
}

export function formatSpeciesTooltip(
  species: PhbSpecies,
  subspecies?: PhbSubspecies,
  speciesLanguageChoices?: string[],
  lookup: LanguageLookup = defaultLanguageLookup()
): string | null {
  const lines: string[] = [];

  lines.push(`${species.size} · ${species.speed} ft`);

  const langLine = formatSpeciesLanguagesLine(
    species,
    subspecies,
    speciesLanguageChoices,
    lookup
  );
  if (langLine) lines.push(langLine);

  if (subspecies?.extras?.length) {
    lines.push(subspecies.extras.join("\n"));
  }

  for (const trait of species.traits) {
    lines.push(`${trait.name}\n${trait.description}`);
  }

  return joinLines(lines);
}

export function formatClassTooltip(cls: PhbClass): string | null {
  const lines: string[] = [];

  lines.push(`Hit Die: d${cls.hitDie}`);

  if (cls.savingThrows.length) {
    const saves = cls.savingThrows.map((k) => ABILITY_LABELS[k as AbilityKey]).join(", ");
    lines.push(`Saving Throws: ${saves}`);
  }

  if (cls.armorProficiencies.length) {
    lines.push(`Armor: ${cls.armorProficiencies.join(", ")}`);
  }

  if (cls.weaponProficiencies.length) {
    lines.push(`Weapons: ${cls.weaponProficiencies.join(", ")}`);
  }

  if (cls.spellcasting) {
    lines.push(
      `Spellcasting: ${ABILITY_LABELS[cls.spellcasting.ability]} · ${cls.spellcasting.spellListId} list`
    );
  }

  for (const feature of cls.features) {
    lines.push(`${feature.name}\n${feature.description}`);
  }

  return joinLines(lines);
}

export function formatBackgroundTooltip(
  bg: PhbBackground,
  backgroundLanguageChoices?: string[],
  lookup: LanguageLookup = defaultLanguageLookup()
): string | null {
  const lines: string[] = [];

  if (bg.skillProficiencies.length) {
    const skills = bg.skillProficiencies
      .map((s) => SKILL_LABELS[s as SkillKey])
      .join(", ");
    lines.push(`Skills: ${skills}`);
  }

  if (bg.toolProficiencies?.length) {
    lines.push(`Tools: ${bg.toolProficiencies.join(", ")}`);
  }

  const langLine = formatBackgroundLanguagesLine(
    bg,
    backgroundLanguageChoices,
    lookup
  );
  if (langLine) lines.push(langLine);

  lines.push(`${bg.feature.name}\n${bg.feature.description}`);

  return joinLines(lines);
}

export function formatSubclassTooltip(subclass: PhbSubclass): string | null {
  const lines: string[] = [];
  for (const feature of subclass.features) {
    lines.push(`${feature.name}\n${feature.description}`);
  }
  return joinLines(lines);
}
