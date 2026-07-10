"use server";

import { createClient as createServerClient } from "@/lib/supabase/server";
import type { Item } from "@/lib/schemas/item";
import { itemSchema } from "@/lib/schemas/item";
import {
  expandSlugsForCatalogFetch,
  mapItemsBySlugWithAliases,
  resolveCanonicalItemSlug,
} from "@/lib/items/slug-aliases";

// ---------------------------------------------------------------------------
// Server-side helpers (used in Server Components and Server Actions)
// ---------------------------------------------------------------------------

/** Fetch a single item by its slug. */
export async function getItem(slug: string): Promise<Item | null> {
  const canonical = resolveCanonicalItemSlug(slug);
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("items")
    .select("*")
    .eq("slug", canonical)
    .maybeSingle();
  if (!data) return null;
  const result = itemSchema.safeParse(data);
  return result.success ? result.data : null;
}

/** Fetch multiple items by their slugs. Returns a slug→item map. */
export async function getItemsBySlugs(
  slugs: string[]
): Promise<Record<string, Item>> {
  if (!slugs.length) return {};
  const fetchSlugs = expandSlugsForCatalogFetch(slugs);
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("items")
    .select("*")
    .in("slug", fetchSlugs);
  const map: Record<string, Item> = {};
  for (const row of data ?? []) {
    const result = itemSchema.safeParse(row);
    if (result.success) map[result.data.slug] = result.data;
  }
  return mapItemsBySlugWithAliases(slugs, map);
}

/** Fetch all items for a category (or all items if no category given). */
export async function getItemsByCategory(
  category?: string
): Promise<Item[]> {
  const supabase = await createServerClient();
  let query = supabase.from("items").select("*").order("name");
  if (category) query = query.eq("category", category);
  const { data } = await query;
  return (data ?? [])
    .map((row) => itemSchema.safeParse(row))
    .filter((r) => r.success)
    .map((r) => r.data as Item);
}

/** Search items by name (full-text or ilike). */
export async function searchItems(
  query: string,
  category?: string,
  limit = 30
): Promise<Item[]> {
  const supabase = await createServerClient();
  let q = supabase
    .from("items")
    .select("*")
    .ilike("name", `%${query}%`)
    .order("name")
    .limit(limit);
  if (category) q = q.eq("category", category);
  const { data } = await q;
  return (data ?? [])
    .map((row) => itemSchema.safeParse(row))
    .filter((r) => r.success)
    .map((r) => r.data as Item);
}

/** Fetch all items (for admin page). */
export async function getAllItems(): Promise<Item[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("items")
    .select("*")
    .order("category")
    .order("name");
  return (data ?? [])
    .map((row) => itemSchema.safeParse(row))
    .filter((r) => r.success)
    .map((r) => r.data as Item);
}

// ---------------------------------------------------------------------------
// Write helpers (DM only — enforced by Supabase RLS)
// ---------------------------------------------------------------------------

export async function upsertItem(
  item: Omit<Item, "id" | "created_at" | "updated_at"> & { id?: string }
): Promise<Item | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("items")
    .upsert(item, { onConflict: "slug" })
    .select()
    .single();
  if (error || !data) return null;
  const result = itemSchema.safeParse(data);
  return result.success ? result.data : null;
}

export async function deleteItem(id: string): Promise<boolean> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("items").delete().eq("id", id);
  return !error;
}
