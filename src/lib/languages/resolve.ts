import type { Language } from "@/lib/schemas/language";
import { ALL_LANGUAGES, type PhbLanguage } from "@/lib/dnd/phb/languages";

export type LanguageLookup = {
  bySlug: Map<string, Language>;
  byNameLower: Map<string, Language>;
};

function phbToLanguage(row: PhbLanguage): Language {
  return {
    id: row.slug,
    slug: row.slug,
    name: row.name,
    script: row.script ?? null,
    is_standard: row.isStandard,
    source: row.source,
    description: row.description ?? "",
  };
}

export function buildLanguageLookup(languages: Language[]): LanguageLookup {
  const bySlug = new Map<string, Language>();
  const byNameLower = new Map<string, Language>();
  for (const lang of languages) {
    bySlug.set(lang.slug, lang);
    byNameLower.set(lang.name.toLowerCase(), lang);
  }
  return { bySlug, byNameLower };
}

export function defaultLanguageLookup(): LanguageLookup {
  return buildLanguageLookup(ALL_LANGUAGES.map(phbToLanguage));
}

export function slugifyLanguageName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Resolve a slug or legacy display name to a catalog slug. */
export function resolveLanguageSlug(
  input: string,
  lookup: LanguageLookup = defaultLanguageLookup()
): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  if (lookup.bySlug.has(trimmed)) return trimmed;

  const byName = lookup.byNameLower.get(trimmed.toLowerCase());
  if (byName) return byName.slug;

  return slugifyLanguageName(trimmed);
}

/** Resolve a slug or legacy display name to the canonical display name. */
export function resolveLanguageName(
  input: string,
  lookup: LanguageLookup = defaultLanguageLookup()
): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  const bySlug = lookup.bySlug.get(trimmed);
  if (bySlug) return bySlug.name;

  const byName = lookup.byNameLower.get(trimmed.toLowerCase());
  if (byName) return byName.name;

  return trimmed;
}

/** Merge automatic grants and player choices into unique display names. */
export function collectLanguageNames(
  inputs: string[],
  lookup: LanguageLookup = defaultLanguageLookup()
): string[] {
  const slugs = new Set<string>();
  for (const input of inputs) {
    if (!input.trim()) continue;
    slugs.add(resolveLanguageSlug(input, lookup));
  }
  return [...slugs].map((slug) => resolveLanguageName(slug, lookup));
}
