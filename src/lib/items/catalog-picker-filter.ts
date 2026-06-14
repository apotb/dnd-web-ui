import {
  getCreatorToolItemsClient,
  getItemsBySlugsClient,
  getItemsBySubcategoryClient,
  searchItemsClient,
} from "@/lib/items/catalog-client";
import type { PhbSpecies } from "@/lib/dnd/phb/types";
import type { Item } from "@/lib/schemas/item";

export type CatalogPickerFilter =
  | {
      kind: "weapon";
      weaponCategory?: "simple" | "martial";
      weaponRange?: "melee" | "ranged";
    }
  | { kind: "instrument" }
  | { kind: "focus" }
  | { kind: "subcategory"; subcategory: string | string[] }
  | { kind: "slugs"; slugs: string[] }
  | { kind: "creator_tools" };

/** @deprecated alias */
export type PlaceholderFilter = CatalogPickerFilter;

export function weaponChoicesToFilter(
  choices: NonNullable<PhbSpecies["weaponChoices"]>
): CatalogPickerFilter {
  const filter = choices.filter;
  return {
    kind: "weapon",
    weaponCategory: filter?.weaponCategory ?? "martial",
    ...(filter?.weaponRange ? { weaponRange: filter.weaponRange } : {}),
  };
}

/**
 * Returns a filter for open-ended equipment/tool placeholders in PHB lists
 * (e.g. "simple weapon", "artisan's tools", "musical instrument").
 */
export function getEquipmentPlaceholderFilter(
  itemName: string
): CatalogPickerFilter | null {
  const key = itemName.toLowerCase().replace(/^any\s+/, "").trim();
  switch (key) {
    case "simple weapon":
      return { kind: "weapon", weaponCategory: "simple" };
    case "simple melee weapon":
      return { kind: "weapon", weaponCategory: "simple", weaponRange: "melee" };
    case "martial weapon":
      return { kind: "weapon", weaponCategory: "martial" };
    case "martial melee weapon":
      return {
        kind: "weapon",
        weaponCategory: "martial",
        weaponRange: "melee",
      };
    case "musical instrument":
      return { kind: "subcategory", subcategory: "musical_instrument" };
    case "artisan's tools":
    case "artisans tools":
      return { kind: "subcategory", subcategory: "artisans_tools" };
    case "gaming set":
      return { kind: "subcategory", subcategory: "gaming_set" };
    case "arcane focus":
      return { kind: "focus" };
    default:
      return null;
  }
}

export function catalogPickerFilterLabel(filter: CatalogPickerFilter): string {
  if (filter.kind === "instrument") return "Choose a musical instrument";
  if (filter.kind === "focus") return "Choose an arcane focus";
  if (filter.kind === "creator_tools") return "Choose a tool";
  if (filter.kind === "slugs") return "Choose an item";
  if (filter.kind === "subcategory") {
    const subs = Array.isArray(filter.subcategory)
      ? filter.subcategory
      : [filter.subcategory];
    if (subs.length === 1) {
      switch (subs[0]) {
        case "musical_instrument":
          return "Choose a musical instrument";
        case "artisans_tools":
          return "Choose artisan's tools";
        case "gaming_set":
          return "Choose a gaming set";
        case "explorer_tools":
          return "Choose explorer's tools";
      }
    }
    if (
      subs.includes("artisans_tools") &&
      subs.includes("musical_instrument")
    ) {
      return "Choose a tool or instrument";
    }
    return "Choose an item";
  }
  const parts: string[] = ["Choose a"];
  if (filter.weaponCategory) parts.push(filter.weaponCategory);
  if (filter.weaponRange) parts.push(filter.weaponRange);
  parts.push("weapon");
  return parts.join(" ");
}

export async function loadCatalogPickerItems(
  filter: CatalogPickerFilter
): Promise<Item[]> {
  switch (filter.kind) {
    case "instrument":
      return getItemsBySubcategoryClient("musical_instrument");
    case "focus":
      return searchItemsClient("", "focus", 50);
    case "subcategory":
      return getItemsBySubcategoryClient(filter.subcategory);
    case "slugs": {
      const bySlug = await getItemsBySlugsClient(filter.slugs);
      return filter.slugs
        .map((slug) => bySlug[slug])
        .filter((item): item is Item => !!item);
    }
    case "creator_tools":
      return getCreatorToolItemsClient();
    case "weapon": {
      const all = await searchItemsClient("", "weapon", 200);
      return all.filter((item) => {
        const props = item.properties as Record<string, unknown>;
        if (filter.weaponCategory && props.weaponCategory !== filter.weaponCategory)
          return false;
        if (filter.weaponRange && props.weaponRange !== filter.weaponRange)
          return false;
        return true;
      });
    }
  }
}
