"use client";

import { createClient } from "@/lib/supabase/client";
import { languageSchema, type Language } from "@/lib/schemas/language";
import { ALL_LANGUAGES } from "@/lib/dnd/phb/languages";

function phbFallbackLanguages(): Language[] {
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

function parseLanguageRows(rows: unknown[]): Language[] {
  return rows
    .map((row) => languageSchema.safeParse(row))
    .filter((r) => r.success)
    .map((r) => r.data as Language);
}

/** Search languages by name. Client-side only. */
export async function searchLanguagesClient(
  query: string,
  options?: { standardOnly?: boolean; limit?: number }
): Promise<Language[]> {
  const limit = options?.limit ?? 40;
  const supabase = createClient();
  let q = supabase.from("languages").select("*").order("name").limit(limit);

  if (query.trim()) {
    q = q.ilike("name", `%${query.trim()}%`);
  }
  if (options?.standardOnly) {
    q = q.eq("is_standard", true);
  }

  const { data, error } = await q;
  if (error || !data?.length) {
    const fallback = phbFallbackLanguages();
    const needle = query.trim().toLowerCase();
    return fallback
      .filter((l) => (options?.standardOnly ? l.is_standard : true))
      .filter((l) => !needle || l.name.toLowerCase().includes(needle))
      .slice(0, limit);
  }

  return parseLanguageRows(data);
}

/** Fetch all languages (admin / catalog preload). */
export async function getAllLanguagesClient(): Promise<Language[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("languages").select("*").order("name");
  if (error || !data?.length) return phbFallbackLanguages();
  return parseLanguageRows(data);
}

/** Fetch languages by slug. */
export async function getLanguagesBySlugsClient(
  slugs: string[]
): Promise<Record<string, Language>> {
  if (!slugs.length) return {};
  const supabase = createClient();
  const { data, error } = await supabase
    .from("languages")
    .select("*")
    .in("slug", slugs);

  const map: Record<string, Language> = {};
  if (error || !data?.length) {
    for (const lang of phbFallbackLanguages()) {
      if (slugs.includes(lang.slug)) map[lang.slug] = lang;
    }
    return map;
  }

  for (const lang of parseLanguageRows(data)) {
    map[lang.slug] = lang;
  }
  return map;
}
