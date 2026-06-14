import type { CharacterData } from "@/lib/schemas/character";
import type { FeatureCatalogs } from "@/lib/character/feature-choices";
import {
  findBackgroundByName,
  findSpeciesByDisplayName,
} from "@/lib/content/catalog-tooltip";
import { PHB_BACKGROUNDS } from "@/lib/dnd/phb/backgrounds";
import { PHB_SPECIES } from "@/lib/dnd/phb/species";
import {
  buildLanguageLookup,
  defaultLanguageLookup,
  resolveLanguageName,
  resolveLanguageSlug,
  type LanguageLookup,
} from "@/lib/languages/resolve";
import type { ProficiencyEntry } from "@/lib/character/proficiency-sources";

function resolveCatalogs(catalogs: FeatureCatalogs = {}) {
  return {
    species: catalogs.species?.length ? catalogs.species : PHB_SPECIES,
    backgrounds: catalogs.backgrounds?.length ? catalogs.backgrounds : PHB_BACKGROUNDS,
  };
}

function speciesLabel(data: CharacterData): string {
  const name = data.basicInfo.species.trim() || "Unknown";
  return `Species (${name})`;
}

type SourceTracker = Map<string, { displayName: string; sources: Set<string> }>;

function trackLanguage(
  tracker: SourceTracker,
  input: string,
  source: string,
  lookup: LanguageLookup
) {
  const slug = resolveLanguageSlug(input, lookup);
  if (!slug) return;
  const name = resolveLanguageName(slug, lookup);
  const entry = tracker.get(slug) ?? { displayName: name, sources: new Set<string>() };
  entry.sources.add(source);
  tracker.set(slug, entry);
}

export function getLanguagesWithSources(
  data: CharacterData,
  catalogs: FeatureCatalogs = {},
  lookup: LanguageLookup = defaultLanguageLookup()
): ProficiencyEntry[] {
  const { species: speciesList, backgrounds } = resolveCatalogs(catalogs);
  const tracker: SourceTracker = new Map();
  const match = findSpeciesByDisplayName(data.basicInfo.species, speciesList);
  const species = match?.species;
  const background = findBackgroundByName(data.basicInfo.background, backgrounds);
  const bgLabel = background?.name
    ? `Background (${background.name})`
    : "Background";
  const speciesName = speciesLabel(data);

  species?.languages.forEach((lang) =>
    trackLanguage(tracker, lang, speciesName, lookup)
  );
  species?.fixedLanguages?.forEach((lang) =>
    trackLanguage(tracker, lang, speciesName, lookup)
  );
  (data.speciesLanguageChoices ?? []).forEach((lang) =>
    trackLanguage(tracker, lang, speciesName, lookup)
  );

  background?.fixedLanguages?.forEach((lang) =>
    trackLanguage(tracker, lang, bgLabel, lookup)
  );
  (data.backgroundLanguageChoices ?? []).forEach((lang) =>
    trackLanguage(tracker, lang, bgLabel, lookup)
  );

  return data.languages.map((lang) => {
    const slug = resolveLanguageSlug(lang, lookup);
    const tracked = tracker.get(slug);
    return {
      name: resolveLanguageName(lang, lookup),
      sources: tracked ? [...tracked.sources].sort() : [],
    };
  });
}

/** Re-export lookup builder for callers that have a DB language catalog. */
export { buildLanguageLookup };
