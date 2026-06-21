"use server";

/**
 * Content catalog — DB-backed spells/species/classes/backgrounds/feats.
 * Falls back to the built-in PHB TypeScript data when the DB tables are empty,
 * so the character creator always receives a fully-populated catalog.
 */

import { createClient as createServerClient } from "@/lib/supabase/server";
import type {
  PhbSpecies,
  PhbBackground,
  PhbClass,
  PhbSpell,
  PhbFeat,
} from "@/lib/dnd/phb/types";
import { ALL_SPECIES, normalizePhbSpecies } from "@/lib/dnd/phb/species";
import { ALL_BACKGROUNDS } from "@/lib/dnd/phb/backgrounds";
import { PHB_CLASSES } from "@/lib/dnd/phb/classes";
import { PHB_SPELLS, SPELL_LISTS } from "@/lib/dnd/phb/spells";
import { PHB_FEATS } from "@/lib/dnd/phb/feats";
import { ALL_LANGUAGES } from "@/lib/dnd/phb/languages";
import type { Language } from "@/lib/schemas/language";

// ── Types ────────────────────────────────────────────────────────────────────

/** A spell from the catalog; includes which class spell lists it belongs to. */
export interface CatalogSpell extends PhbSpell {
  classes: string[];
}

/** Full catalog passed to CharacterCreator and build-character functions. */
export interface CreatorCatalog {
  species: PhbSpecies[];
  classes: PhbClass[];
  backgrounds: PhbBackground[];
  spells: CatalogSpell[];
  feats: PhbFeat[];
  languages: Language[];
}

// ── DB row → domain type helpers ─────────────────────────────────────────────

function rowToSpecies(row: Record<string, unknown>): PhbSpecies | null {
  try {
    const raw = row.data as PhbSpecies & { subraces?: PhbSpecies["subspecies"] };
    return normalizePhbSpecies({
      ...raw,
      id: row.slug as string,
      name: row.name as string,
    });
  } catch {
    return null;
  }
}

function rowToClass(row: Record<string, unknown>): PhbClass | null {
  try {
    return { ...(row.data as PhbClass), id: row.slug as string, name: row.name as string };
  } catch {
    return null;
  }
}

function rowToBackground(row: Record<string, unknown>): PhbBackground | null {
  try {
    return { ...(row.data as PhbBackground), id: row.slug as string, name: row.name as string };
  } catch {
    return null;
  }
}

function rowToSpell(row: Record<string, unknown>): CatalogSpell | null {
  try {
    return {
      id: row.slug as string,
      name: row.name as string,
      level: row.level as number,
      school: row.school as string,
      castingTime: row.casting_time as string,
      range: row.range as string,
      components: row.components as string,
      duration: row.duration as string,
      description: row.description as string,
      ritual: row.ritual as boolean | undefined,
      concentration: row.concentration as boolean | undefined,
      classes: (row.classes as string[]) ?? [],
    };
  } catch {
    return null;
  }
}

function rowToFeat(row: Record<string, unknown>): PhbFeat | null {
  try {
    return {
      id: row.slug as string,
      name: row.name as string,
      description: row.description as string,
      ...(row.data as Partial<PhbFeat>),
    };
  } catch {
    return null;
  }
}

function rowToLanguage(row: Record<string, unknown>): Language | null {
  try {
    return {
      id: row.id as string,
      slug: row.slug as string,
      name: row.name as string,
      script: (row.script as string | null) ?? null,
      is_standard: row.is_standard as boolean,
      source: row.source as string,
      description: (row.description as string) ?? "",
      created_at: row.created_at as string | undefined,
      updated_at: row.updated_at as string | undefined,
    };
  } catch {
    return null;
  }
}

function phbLanguageFallback(): Language[] {
  return ALL_LANGUAGES.map((l) => ({
    id: l.slug,
    slug: l.slug,
    name: l.name,
    script: l.script ?? null,
    is_standard: l.isStandard,
    source: l.source,
    description: l.description ?? "",
  }));
}

// ── Derive classes array from SPELL_LISTS (for built-in spells) ───────────────

function buildSpellClassesMap(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const [listId, slugs] of Object.entries(SPELL_LISTS)) {
    for (const slug of slugs) {
      if (!map.has(slug)) map.set(slug, []);
      map.get(slug)!.push(listId);
    }
  }
  return map;
}

const SPELL_CLASSES_MAP = buildSpellClassesMap();

function toCatalogSpell(s: PhbSpell): CatalogSpell {
  return { ...s, classes: SPELL_CLASSES_MAP.get(s.id) ?? [] };
}

// ── Fetch functions ───────────────────────────────────────────────────────────

export async function fetchCatalogSpecies(): Promise<PhbSpecies[]> {
  const supabase = await createServerClient();
  const { data } = await supabase.from("species").select("*").order("name");
  const rows = (data ?? []).map(rowToSpecies).filter(Boolean) as PhbSpecies[];
  return rows.length > 0 ? rows : ALL_SPECIES;
}

export async function fetchCatalogClasses(): Promise<PhbClass[]> {
  const supabase = await createServerClient();
  const { data } = await supabase.from("classes").select("*").order("name");
  const rows = (data ?? []).map(rowToClass).filter(Boolean) as PhbClass[];
  return rows.length > 0 ? rows : PHB_CLASSES;
}

export async function fetchCatalogBackgrounds(): Promise<PhbBackground[]> {
  const supabase = await createServerClient();
  const { data } = await supabase.from("backgrounds").select("*").order("name");
  const rows = (data ?? []).map(rowToBackground).filter(Boolean) as PhbBackground[];
  return rows.length > 0 ? rows : ALL_BACKGROUNDS;
}

export async function fetchCatalogSpells(): Promise<CatalogSpell[]> {
  const supabase = await createServerClient();
  const { data } = await supabase.from("spells").select("*").order("level").order("name");
  const rows = (data ?? []).map(rowToSpell).filter(Boolean) as CatalogSpell[];
  return rows.length > 0 ? rows : PHB_SPELLS.map(toCatalogSpell);
}

export async function fetchCatalogFeats(): Promise<PhbFeat[]> {
  const supabase = await createServerClient();
  const { data } = await supabase.from("feats").select("*").order("name");
  const rows = (data ?? []).map(rowToFeat).filter(Boolean) as PhbFeat[];
  return rows.length > 0 ? rows : PHB_FEATS;
}

export async function fetchCatalogLanguages(): Promise<Language[]> {
  const supabase = await createServerClient();
  const { data } = await supabase.from("languages").select("*").order("name");
  const rows = (data ?? []).map(rowToLanguage).filter(Boolean) as Language[];
  return rows.length > 0 ? rows : phbLanguageFallback();
}

/** Fetch the full catalog in one parallel call. */
export async function fetchCatalog(): Promise<CreatorCatalog> {
  const [species, classes, backgrounds, spells, feats, languages] = await Promise.all([
    fetchCatalogSpecies(),
    fetchCatalogClasses(),
    fetchCatalogBackgrounds(),
    fetchCatalogSpells(),
    fetchCatalogFeats(),
    fetchCatalogLanguages(),
  ]);
  return { species, classes, backgrounds, spells, feats, languages };
}

// ── Seed server actions (DM only — called from admin pages) ──────────────────

export async function seedSpecies(): Promise<{ seeded: number; error?: string }> {
  const supabase = await createServerClient();
  const rows = ALL_SPECIES.map((r) => ({
    slug: r.id,
    name: r.name,
    source: "PHB",
    data: r,
  }));
  const { error } = await supabase.from("species").upsert(rows, { onConflict: "slug" });
  if (error) return { seeded: 0, error: error.message };
  return { seeded: rows.length };
}

export async function seedClasses(): Promise<{ seeded: number; error?: string }> {
  const supabase = await createServerClient();
  const rows = PHB_CLASSES.map((c) => ({
    slug: c.id,
    name: c.name,
    hit_die: c.hitDie,
    source: "PHB",
    data: c,
  }));
  const { error } = await supabase.from("classes").upsert(rows, { onConflict: "slug" });
  if (error) return { seeded: 0, error: error.message };
  return { seeded: rows.length };
}

export async function seedBackgrounds(): Promise<{ seeded: number; error?: string }> {
  const supabase = await createServerClient();
  const rows = ALL_BACKGROUNDS.map((b) => ({
    slug: b.id,
    name: b.name,
    source: "PHB",
    data: b,
  }));
  const { error } = await supabase.from("backgrounds").upsert(rows, { onConflict: "slug" });
  if (error) return { seeded: 0, error: error.message };
  return { seeded: rows.length };
}

export async function seedSpells(): Promise<{ seeded: number; error?: string }> {
  const supabase = await createServerClient();
  const classesMap = buildSpellClassesMap();
  const rows = PHB_SPELLS.map((s) => ({
    slug: s.id,
    name: s.name,
    level: s.level,
    school: s.school,
    casting_time: s.castingTime,
    range: s.range,
    components: s.components,
    duration: s.duration,
    description: s.description,
    ritual: s.ritual ?? false,
    concentration: s.concentration ?? false,
    classes: classesMap.get(s.id) ?? [],
    source: "PHB",
  }));
  const { error } = await supabase.from("spells").upsert(rows, { onConflict: "slug" });
  if (error) return { seeded: 0, error: error.message };
  return { seeded: rows.length };
}

export async function seedFeats(): Promise<{ seeded: number; error?: string }> {
  const supabase = await createServerClient();
  const rows = PHB_FEATS.map((f) => ({
    slug: f.id,
    name: f.name,
    description: f.description,
    source: "PHB",
    data: f.abilityIncrease ? { abilityIncrease: f.abilityIncrease } : {},
  }));
  const { error } = await supabase.from("feats").upsert(rows, { onConflict: "slug" });
  if (error) return { seeded: 0, error: error.message };
  return { seeded: rows.length };
}

export async function seedLanguages(): Promise<{ seeded: number; error?: string }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("seed_default_languages");
  if (error) {
    // Fallback for databases that have not applied migration 013 yet.
    const rows = ALL_LANGUAGES.map((l) => ({
      slug: l.slug,
      name: l.name,
      script: l.script ?? null,
      is_standard: l.isStandard,
      source: l.source,
      description: l.description ?? "",
    }));
    const fallback = await supabase.from("languages").upsert(rows, { onConflict: "slug" });
    if (fallback.error) return { seeded: 0, error: fallback.error.message };
    return { seeded: rows.length };
  }
  return { seeded: typeof data === "number" ? data : ALL_LANGUAGES.length };
}

// ── Single-record CRUD (for admin UI) ─────────────────────────────────────────

export async function upsertSpeciesEntry(slug: string, name: string, source: string, data: unknown): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("species").upsert({ slug, name, source, data }, { onConflict: "slug" });
  return { error: error?.message };
}

export async function deleteSpeciesEntry(slug: string): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("species").delete().eq("slug", slug);
  return { error: error?.message };
}

export async function upsertClassEntry(slug: string, name: string, hitDie: number, source: string, data: unknown): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("classes").upsert({ slug, name, hit_die: hitDie, source, data }, { onConflict: "slug" });
  return { error: error?.message };
}

export async function deleteClassEntry(slug: string): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("classes").delete().eq("slug", slug);
  return { error: error?.message };
}

export async function upsertBackgroundEntry(slug: string, name: string, source: string, data: unknown): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("backgrounds").upsert({ slug, name, source, data }, { onConflict: "slug" });
  return { error: error?.message };
}

export async function deleteBackgroundEntry(slug: string): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("backgrounds").delete().eq("slug", slug);
  return { error: error?.message };
}

export async function upsertSpellEntry(
  slug: string,
  name: string,
  level: number,
  school: string,
  castingTime: string,
  range: string,
  components: string,
  duration: string,
  description: string,
  ritual: boolean,
  concentration: boolean,
  classes: string[],
  source: string,
): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("spells").upsert({
    slug, name, level, school, casting_time: castingTime, range, components,
    duration, description, ritual, concentration, classes, source,
  }, { onConflict: "slug" });
  return { error: error?.message };
}

export async function deleteSpellEntry(slug: string): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("spells").delete().eq("slug", slug);
  return { error: error?.message };
}

export async function upsertFeatEntry(slug: string, name: string, description: string, prerequisite: string | null, source: string, data: unknown): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("feats").upsert({ slug, name, description, prerequisite: prerequisite || null, source, data }, { onConflict: "slug" });
  return { error: error?.message };
}

export async function deleteFeatEntry(slug: string): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("feats").delete().eq("slug", slug);
  return { error: error?.message };
}

export async function upsertLanguageEntry(
  slug: string,
  name: string,
  script: string | null,
  isStandard: boolean,
  source: string,
  description: string
): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("languages").upsert(
    {
      slug,
      name,
      script,
      is_standard: isStandard,
      source,
      description,
    },
    { onConflict: "slug" }
  );
  return { error: error?.message };
}

export async function deleteLanguageEntry(slug: string): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("languages").delete().eq("slug", slug);
  return { error: error?.message };
}

export async function upsertEnemyEntry(
  slug: string,
  name: string,
  source: string,
  data: unknown
): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("enemies")
    .upsert({ slug, name, source, data }, { onConflict: "slug" });
  return { error: error?.message };
}

export async function deleteEnemyEntry(slug: string): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("enemies").delete().eq("slug", slug);
  return { error: error?.message };
}
