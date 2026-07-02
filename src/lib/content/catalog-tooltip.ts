import {
  getSpeciesTooltipFeatures,
  getTooltipClassFeatures,
  getTooltipSubclassFeatures,
} from "@/lib/character/feature-derivation";
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

function formatUnlockedFeaturesLine(
  features: { name: string }[],
  label: string
): string | null {
  if (!features.length) return null;
  const items = features.map((f) => `• ${f.name}`).join("\n");
  return `${label}\n${items}`;
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
  const aliases: Record<string, string> = {
    "path of the berserker": "primal path: berserker",
    "path of the totem warrior": "totem warrior",
    "school of evocation": "arcane tradition: evocation",
    "champion": "martial archetype: champion",
    "college of lore": "bard college: lore",
  };
  const idAliases: Record<string, string> = {
    "knowledge domain": "knowledge",
    "nature domain": "nature",
    "tempest domain": "tempest",
    "circle of the land": "land",
    "circle of the moon": "moon",
  };
  const resolved = aliases[normalized] ?? normalized;
  const subclass =
    cls.subclasses.find((s) => s.name.toLowerCase() === resolved) ??
    cls.subclasses.find((s) => s.id === (idAliases[normalized] ?? normalized.replace(/\s+/g, "-"))) ??
    cls.subclasses.find((s) => resolved.includes(s.name.toLowerCase()));
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

  for (const feature of getSpeciesTooltipFeatures(species, subspecies)) {
    lines.push(`${feature.name}\n${feature.description}`);
  }

  return joinLines(lines);
}

export function formatClassTooltip(cls: PhbClass, characterLevel?: number): string | null {
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
    lines.push(`Spellcasting: ${ABILITY_LABELS[cls.spellcasting.ability]}`);
  }

  const features =
    characterLevel != null
      ? getTooltipClassFeatures(cls, characterLevel)
      : cls.features;

  const featuresLine = formatUnlockedFeaturesLine(features, "Class features:");
  if (featuresLine) lines.push(featuresLine);

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

export function formatSubclassTooltip(
  subclass: PhbSubclass,
  characterLevel?: number
): string | null {
  const features =
    characterLevel != null
      ? getTooltipSubclassFeatures(subclass, characterLevel)
      : subclass.features;
  const featuresLine = formatUnlockedFeaturesLine(features, "Subclass features:");
  return featuresLine ? joinLines([featuresLine]) : null;
}
