"use client";

import { createClient } from "@/lib/supabase/client";
import { itemSchema, type Item } from "@/lib/schemas/item";

/** Search items by name, optionally filtered by category. Client-side only. */
export async function searchItemsClient(
  query: string,
  category?: string,
  limit = 30
): Promise<Item[]> {
  const supabase = createClient();
  let q = supabase
    .from("items")
    .select("*")
    .order("name")
    .limit(limit);

  if (query.trim()) {
    q = q.ilike("name", `%${query.trim()}%`);
  }
  if (category) {
    q = q.eq("category", category);
  }

  const { data } = await q;
  return (data ?? [])
    .map((row) => itemSchema.safeParse(row))
    .filter((r) => r.success)
    .map((r) => r.data as Item);
}

/** Fetch items by slugs. Client-side only. */
export async function getItemsBySlugsClient(
  slugs: string[]
): Promise<Record<string, Item>> {
  if (!slugs.length) return {};
  const supabase = createClient();
  const { data } = await supabase
    .from("items")
    .select("*")
    .in("slug", slugs);
  const map: Record<string, Item> = {};
  for (const row of data ?? []) {
    const result = itemSchema.safeParse(row);
    if (result.success) map[result.data.slug] = result.data;
  }
  return map;
}

/** Fetch all items (used by admin page client-side re-fetch). */
export async function getAllItemsClient(): Promise<Item[]> {
  const supabase = createClient();
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
