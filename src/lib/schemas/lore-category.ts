import { z } from "zod";

export const loreCategorySchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  label: z.string().default(""),
  sortOrder: z.number().int().default(0),
});

export type LoreCategory = z.infer<typeof loreCategorySchema>;

export const DEFAULT_NOTABLE_CATEGORIES: LoreCategory[] = [
  { id: "port-nyanzaru", label: "Merchant Princes", sortOrder: 0 },
  { id: "minor-characters", label: "Port Nyanzaru", sortOrder: 1 },
];

export const DEFAULT_NOTABLE_CATEGORY_ID = "minor-characters";

export function sortCategories(categories: LoreCategory[]): LoreCategory[] {
  return [...categories].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)
  );
}

export function getCategoryLabel(
  categories: LoreCategory[],
  categoryId: string
): string {
  return (
    categories.find((entry) => entry.id === categoryId)?.label ?? categoryId
  );
}

export function ensureCategories(
  input: unknown,
  defaults: LoreCategory[]
): LoreCategory[] {
  if (!input || typeof input !== "object") {
    return sortCategories(defaults);
  }
  const raw = input as { categories?: unknown };
  if (!Array.isArray(raw.categories) || raw.categories.length === 0) {
    return sortCategories(defaults);
  }
  return sortCategories(
    raw.categories.map((category) => loreCategorySchema.parse(category))
  );
}

export function newCategory(label: string, sortOrder = 0): LoreCategory {
  return loreCategorySchema.parse({ label, sortOrder });
}

export function countItemsInCategory<T extends { category: string }>(
  items: T[],
  categoryId: string
): number {
  return items.filter((item) => item.category === categoryId).length;
}

export function canRemoveCategory<T extends { category: string }>(
  items: T[],
  categoryId: string
): boolean {
  return countItemsInCategory(items, categoryId) === 0;
}

export function itemCountsByCategory<T extends { category: string }>(
  items: T[],
  categories: LoreCategory[]
): Map<string, number> {
  return new Map(
    categories.map((category) => [
      category.id,
      countItemsInCategory(items, category.id),
    ])
  );
}
