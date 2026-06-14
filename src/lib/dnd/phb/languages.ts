/** Built-in language catalog — seeded to DB and used as fallback when table is empty. */

import { PHB_BACKGROUNDS, TOA_BACKGROUNDS } from "./backgrounds";
import { EXTENDED_BACKGROUNDS } from "./extended-backgrounds";
import { ALL_SPECIES } from "./species";

export interface PhbLanguage {
  slug: string;
  name: string;
  isStandard: boolean;
  script?: string;
  source: string;
  description?: string;
}

const STANDARD_LANGUAGE_NAMES = new Set([
  "Common",
  "Dwarvish",
  "Elvish",
  "Giant",
  "Gnomish",
  "Goblin",
  "Halfling",
  "Orc",
  "Abyssal",
  "Celestial",
  "Draconic",
  "Deep Speech",
  "Infernal",
  "Primordial",
  "Sylvan",
  "Undercommon",
]);

export function slugifyLanguageName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Core PHB + published setting languages with metadata. */
export const PHB_LANGUAGES: PhbLanguage[] = [
  { slug: "common", name: "Common", isStandard: true, script: "Common", source: "PHB" },
  { slug: "dwarvish", name: "Dwarvish", isStandard: true, script: "Dwarvish", source: "PHB" },
  { slug: "elvish", name: "Elvish", isStandard: true, script: "Elvish", source: "PHB" },
  { slug: "giant", name: "Giant", isStandard: true, script: "Dwarvish", source: "PHB" },
  { slug: "gnomish", name: "Gnomish", isStandard: true, script: "Dwarvish", source: "PHB" },
  { slug: "goblin", name: "Goblin", isStandard: true, script: "Dwarvish", source: "PHB" },
  { slug: "halfling", name: "Halfling", isStandard: true, script: "Common", source: "PHB" },
  { slug: "orc", name: "Orc", isStandard: true, script: "Dwarvish", source: "PHB" },
  { slug: "abyssal", name: "Abyssal", isStandard: true, script: "Infernal", source: "PHB" },
  { slug: "celestial", name: "Celestial", isStandard: true, script: "Celestial", source: "PHB" },
  { slug: "draconic", name: "Draconic", isStandard: true, script: "Draconic", source: "PHB" },
  {
    slug: "deep-speech",
    name: "Deep Speech",
    isStandard: true,
    source: "PHB",
    description: "No written form.",
  },
  { slug: "infernal", name: "Infernal", isStandard: true, script: "Infernal", source: "PHB" },
  { slug: "primordial", name: "Primordial", isStandard: true, script: "Dwarvish", source: "PHB" },
  { slug: "sylvan", name: "Sylvan", isStandard: true, script: "Elvish", source: "PHB" },
  { slug: "undercommon", name: "Undercommon", isStandard: true, script: "Elvish", source: "PHB" },
  { slug: "gith", name: "Gith", isStandard: false, source: "Mordenkainen's Tome of Foes" },
  { slug: "quori", name: "Quori", isStandard: false, source: "Eberron" },
  { slug: "aarakocra", name: "Aarakocra", isStandard: false, source: "Elemental Evil" },
  { slug: "auran", name: "Auran", isStandard: false, script: "Dwarvish", source: "PHB", description: "Primordial dialect (air)." },
  { slug: "aquan", name: "Aquan", isStandard: false, script: "Dwarvish", source: "PHB", description: "Primordial dialect (water)." },
  { slug: "ignan", name: "Ignan", isStandard: false, script: "Dwarvish", source: "PHB", description: "Primordial dialect (fire)." },
  { slug: "terran", name: "Terran", isStandard: false, script: "Dwarvish", source: "PHB", description: "Primordial dialect (earth)." },
];

/** Class / feature languages not tied to a single species row. */
export const EXTRA_LANGUAGES: PhbLanguage[] = [
  {
    slug: "druidic",
    name: "Druidic",
    isStandard: false,
    source: "PHB",
    description: "Secret language of druids.",
  },
  {
    slug: "thieves-cant",
    name: "Thieves' Cant",
    isStandard: false,
    source: "PHB",
    description: "Secret mix of dialect, jargon, and code used by rogues.",
  },
];

function mergeLanguageName(name: string, source: string): PhbLanguage {
  const slug = slugifyLanguageName(name);
  const existing = PHB_LANGUAGES.find(
    (l) => l.slug === slug || l.name.toLowerCase() === name.toLowerCase()
  );
  if (existing) return existing;

  return {
    slug,
    name,
    isStandard: STANDARD_LANGUAGE_NAMES.has(name),
    source,
  };
}

/** All languages used by the character creator catalog (species, backgrounds, extras). */
export function buildAllLanguages(): PhbLanguage[] {
  const bySlug = new Map<string, PhbLanguage>();

  for (const lang of [...PHB_LANGUAGES, ...EXTRA_LANGUAGES]) {
    bySlug.set(lang.slug, lang);
  }

  for (const species of ALL_SPECIES) {
    for (const name of [...species.languages, ...(species.fixedLanguages ?? [])]) {
      const entry = mergeLanguageName(name, "Species");
      bySlug.set(entry.slug, entry);
    }
  }

  for (const bg of [...PHB_BACKGROUNDS, ...TOA_BACKGROUNDS, ...EXTENDED_BACKGROUNDS]) {
    for (const name of bg.fixedLanguages ?? []) {
      const entry = mergeLanguageName(name, "Background");
      bySlug.set(entry.slug, entry);
    }
  }

  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const ALL_LANGUAGES = buildAllLanguages();

/** @deprecated Use ALL_LANGUAGES / languages table instead. */
export const STANDARD_LANGUAGES = ALL_LANGUAGES.filter((l) => l.isStandard).map(
  (l) => l.name
);

/** SQL literal for migrations / scripts. */
export function languageRowToSql(l: PhbLanguage): string {
  const esc = (s: string) => s.replace(/'/g, "''");
  const script = l.script ? `'${esc(l.script)}'` : "NULL";
  const desc = esc(l.description ?? "");
  const source = esc(l.source);
  return `  ('${esc(l.slug)}', '${esc(l.name)}', ${script}, ${l.isStandard}, '${source}', '${desc}')`;
}

export function allLanguagesUpsertSql(): string {
  const rows = ALL_LANGUAGES.map(languageRowToSql).join(",\n");
  return `-- Auto-generated from src/lib/dnd/phb/languages.ts (ALL_LANGUAGES)
INSERT INTO public.languages (slug, name, script, is_standard, source, description) VALUES
${rows}
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  script = EXCLUDED.script,
  is_standard = EXCLUDED.is_standard,
  source = EXCLUDED.source,
  description = EXCLUDED.description,
  updated_at = NOW();
`;
}
