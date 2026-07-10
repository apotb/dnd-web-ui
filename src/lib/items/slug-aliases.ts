/**
 * Maps removed duplicate catalog slugs to their canonical replacement.
 * Used after migration 082_dedup_focus_items.sql.
 */
export const REMOVED_ITEM_SLUG_ALIASES: Record<string, string> = {
  // Druidic focus variants → druidic-focus
  "sprig-of-mistletoe": "druidic-focus",
  totem: "druidic-focus",
  "wooden-staff": "druidic-focus",
  "yew-wand": "druidic-focus",
  // Arcane focus variants → arcane-focus
  crystal: "arcane-focus",
  orb: "arcane-focus",
  rod: "arcane-focus",
  staff: "arcane-focus",
  wand: "arcane-focus",
  // Holy symbol variants → holy-symbol
  amulet: "holy-symbol",
  emblem: "holy-symbol",
  reliquary: "holy-symbol",
  // Holy water duplicate → holy-water
  "holy-water-flask": "holy-water",
};

export function resolveCanonicalItemSlug(slug: string): string {
  return REMOVED_ITEM_SLUG_ALIASES[slug] ?? slug;
}

export function expandSlugsForCatalogFetch(slugs: string[]): string[] {
  const out = new Set<string>();
  for (const slug of slugs) {
    out.add(slug);
    out.add(resolveCanonicalItemSlug(slug));
  }
  return [...out];
}

/** Map fetched items so legacy inventory slugs still resolve. */
export function mapItemsBySlugWithAliases(
  requestedSlugs: string[],
  fetched: Record<string, import("@/lib/schemas/item").Item>
): Record<string, import("@/lib/schemas/item").Item> {
  const map = { ...fetched };
  for (const slug of requestedSlugs) {
    const canonical = resolveCanonicalItemSlug(slug);
    const item = fetched[canonical];
    if (item) map[slug] = item;
  }
  return map;
}
