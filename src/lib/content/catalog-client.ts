"use client";

import { createClient } from "@/lib/supabase/client";
import { ALL_BACKGROUNDS } from "@/lib/dnd/phb/backgrounds";
import { PHB_CLASSES } from "@/lib/dnd/phb/classes";
import {
  mergeClassesWithPhb,
  mergeSpeciesListWithPhb,
} from "@/lib/content/catalog-merge";
import { ALL_SPECIES, normalizePhbSpecies } from "@/lib/dnd/phb/species";
import { ALL_SPELLS, SPELL_LISTS } from "@/lib/dnd/phb/spells";
import { PHB_CONDITIONS, type PhbCondition } from "@/lib/dnd/conditions";
import type { PhbBackground, PhbClass, PhbSpecies, PhbSpell } from "@/lib/dnd/phb/types";

export interface CatalogSpellRow {
  slug: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  description: string;
  ritual: boolean;
  concentration: boolean;
  classes: string[];
}

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

function phbSpellToRow(spell: PhbSpell): CatalogSpellRow {
  return {
    slug: spell.id,
    name: spell.name,
    level: spell.level,
    school: spell.school,
    castingTime: spell.castingTime,
    range: spell.range,
    components: spell.components,
    duration: spell.duration,
    description: spell.description,
    ritual: spell.ritual ?? false,
    concentration: spell.concentration ?? false,
    classes: spell.classes ?? SPELL_CLASSES_MAP.get(spell.id) ?? [],
  };
}

const PHB_SPELL_ROWS = ALL_SPELLS.map(phbSpellToRow);

function mapSpellRow(row: Record<string, unknown>): CatalogSpellRow | null {
  if (typeof row.slug !== "string" || typeof row.name !== "string") return null;
  return {
    slug: row.slug,
    name: row.name,
    level: typeof row.level === "number" ? row.level : 0,
    school: typeof row.school === "string" ? row.school : "",
    castingTime: typeof row.casting_time === "string" ? row.casting_time : "",
    range: typeof row.range === "string" ? row.range : "",
    components: typeof row.components === "string" ? row.components : "",
    duration: typeof row.duration === "string" ? row.duration : "",
    description: typeof row.description === "string" ? row.description : "",
    ritual: row.ritual === true,
    concentration: row.concentration === true,
    classes: Array.isArray(row.classes) ? (row.classes as string[]) : [],
  };
}

function filterSpellRows(
  rows: CatalogSpellRow[],
  query: string,
  options?: {
    level?: number | "all";
    classListId?: string;
    limit?: number;
  }
): CatalogSpellRow[] {
  const limit = options?.limit ?? 50;
  let filtered = rows;

  if (query.trim()) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter((s) => s.name.toLowerCase().includes(q));
  }
  if (options?.level !== undefined && options.level !== "all") {
    filtered = filtered.filter((s) => s.level === options.level);
  }
  if (options?.classListId) {
    filtered = filtered.filter((s) => s.classes.includes(options.classListId!));
  }

  return filtered.slice(0, limit);
}

/** Search spells by name, optionally filtered by level and class list. */
export async function searchSpellsClient(
  query: string,
  options?: {
    level?: number | "all";
    classListId?: string;
    limit?: number;
  }
): Promise<CatalogSpellRow[]> {
  const supabase = createClient();
  const limit = options?.limit ?? 50;

  let q = supabase.from("spells").select("*").order("level").order("name").limit(limit);

  if (query.trim()) {
    q = q.ilike("name", `%${query.trim()}%`);
  }
  if (options?.level !== undefined && options.level !== "all") {
    q = q.eq("level", options.level);
  }
  if (options?.classListId) {
    q = q.contains("classes", [options.classListId]);
  }

  const { data } = await q;
  const dbRows = (data ?? [])
    .map((row) => mapSpellRow(row as Record<string, unknown>))
    .filter((s): s is CatalogSpellRow => s !== null);

  if (dbRows.length > 0) {
    return dbRows;
  }

  return filterSpellRows(PHB_SPELL_ROWS, query, options);
}

/** Fetch spells by catalog slugs. */
export async function getSpellsBySlugsClient(
  slugs: string[]
): Promise<Record<string, CatalogSpellRow>> {
  if (!slugs.length) return {};
  const supabase = createClient();
  const { data } = await supabase.from("spells").select("*").in("slug", slugs);
  const map: Record<string, CatalogSpellRow> = {};
  for (const row of data ?? []) {
    const spell = mapSpellRow(row as Record<string, unknown>);
    if (spell) map[spell.slug] = spell;
  }

  for (const slug of slugs) {
    if (!map[slug]) {
      const fallback = PHB_SPELL_ROWS.find((s) => s.slug === slug);
      if (fallback) map[slug] = fallback;
    }
  }

  return map;
}

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

function rowToBackground(row: Record<string, unknown>): PhbBackground | null {
  try {
    return {
      ...(row.data as PhbBackground),
      id: row.slug as string,
      name: row.name as string,
    };
  } catch {
    return null;
  }
}

function rowToClass(row: Record<string, unknown>): PhbClass | null {
  try {
    return {
      ...(row.data as PhbClass),
      id: row.slug as string,
      name: row.name as string,
    };
  } catch {
    return null;
  }
}

/** Fetch species for sheet tooltips. */
export async function fetchCatalogSpeciesClient(): Promise<PhbSpecies[]> {
  const supabase = createClient();
  const { data } = await supabase.from("species").select("*").order("name");
  const rows = (data ?? [])
    .map((row) => rowToSpecies(row as Record<string, unknown>))
    .filter(Boolean) as PhbSpecies[];
  if (rows.length === 0) return ALL_SPECIES;
  return mergeSpeciesListWithPhb(rows, ALL_SPECIES);
}

/** Fetch backgrounds for sheet tooltips. */
export async function fetchCatalogBackgroundsClient(): Promise<PhbBackground[]> {
  const supabase = createClient();
  const { data } = await supabase.from("backgrounds").select("*").order("name");
  const rows = (data ?? [])
    .map((row) => rowToBackground(row as Record<string, unknown>))
    .filter(Boolean) as PhbBackground[];
  return rows.length > 0 ? rows : ALL_BACKGROUNDS;
}

/** Fetch classes when not provided from the server. */
export async function fetchCatalogClassesClient(): Promise<PhbClass[]> {
  const supabase = createClient();
  const { data } = await supabase.from("classes").select("*").order("name");
  const rows = (data ?? [])
    .map((row) => rowToClass(row as Record<string, unknown>))
    .filter(Boolean) as PhbClass[];
  if (rows.length === 0) return PHB_CLASSES;
  return mergeClassesWithPhb(rows, PHB_CLASSES);
}

function mapConditionRow(row: Record<string, unknown>): PhbCondition | null {
  if (typeof row.slug !== "string" || typeof row.name !== "string") return null;
  return {
    slug: row.slug,
    name: row.name,
    description: typeof row.description === "string" ? row.description : "",
    isStandard: row.is_standard === true,
    source: typeof row.source === "string" ? row.source : "SRD",
  };
}

/** Fetch conditions catalog for character sheet picker and tooltips. */
export async function fetchCatalogConditionsClient(): Promise<PhbCondition[]> {
  const supabase = createClient();
  const { data } = await supabase.from("conditions").select("*").order("name");
  const rows = (data ?? [])
    .map((row) => mapConditionRow(row as Record<string, unknown>))
    .filter((c): c is PhbCondition => c !== null);
  return rows.length > 0 ? rows : PHB_CONDITIONS;
}
