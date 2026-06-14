import {
  findBackgroundByName,
  findSpeciesByDisplayName,
} from "@/lib/content/catalog-tooltip";
import { PHB_BACKGROUNDS } from "@/lib/dnd/phb/backgrounds";
import { PHB_SPECIES } from "@/lib/dnd/phb/species";
import type { PhbBackground, PhbSpecies } from "@/lib/dnd/phb/types";
import {
  defaultLanguageLookup,
  resolveLanguageSlug,
  type LanguageLookup,
} from "@/lib/languages/resolve";
import type { CharacterData } from "@/lib/schemas/character";

function speciesLanguageChoiceCount(
  species: PhbSpecies,
  subspeciesId?: string
): number {
  return (species.languageChoices ?? 0) + (species.id === "elf" && subspeciesId === "high" ? 1 : 0);
}

function automaticLanguageSlugs(
  species: PhbSpecies | undefined,
  background: PhbBackground | undefined,
  lookup: LanguageLookup
): Set<string> {
  const slugs = new Set<string>();
  for (const name of [
    ...(species?.languages ?? []),
    ...(species?.fixedLanguages ?? []),
    ...(background?.fixedLanguages ?? []),
  ]) {
    if (name.trim()) slugs.add(resolveLanguageSlug(name, lookup));
  }
  return slugs;
}

/** Infer stored language picks from the merged languages list (legacy saves). */
export function migrateLanguageChoices(data: CharacterData): CharacterData {
  if (
    (data.speciesLanguageChoices?.length ?? 0) > 0 ||
    (data.backgroundLanguageChoices?.length ?? 0) > 0
  ) {
    return data;
  }

  const lookup = defaultLanguageLookup();
  const speciesMatch = findSpeciesByDisplayName(data.basicInfo.species, PHB_SPECIES);
  const background = findBackgroundByName(data.basicInfo.background, PHB_BACKGROUNDS);
  const speciesChoiceCount = speciesMatch
    ? speciesLanguageChoiceCount(speciesMatch.species, speciesMatch.subspecies?.id)
    : 0;
  const backgroundChoiceCount = background?.languageChoices ?? 0;

  if (speciesChoiceCount === 0 && backgroundChoiceCount === 0) {
    return data;
  }

  const automatic = automaticLanguageSlugs(speciesMatch?.species, background ?? undefined, lookup);
  const extraSlugs = data.languages
    .map((name) => resolveLanguageSlug(name, lookup))
    .filter((slug) => slug && !automatic.has(slug));

  return {
    ...data,
    speciesLanguageChoices: extraSlugs.slice(0, speciesChoiceCount),
    backgroundLanguageChoices: extraSlugs.slice(
      speciesChoiceCount,
      speciesChoiceCount + backgroundChoiceCount
    ),
  };
}
