import { z } from "zod";
import {
  BACKPACK_CARRY_CAPACITY_BONUS_LB,
  BACKPACK_ITEM_SLUG,
} from "@/lib/character/encumbrance";
import type { InventoryItem } from "@/lib/schemas/character";

export const ITEM_CATEGORIES = [
  "weapon",
  "armor",
  "shield",
  "adventuring_gear",
  "tool",
  "ammunition",
  "focus",
  "pack",
  "mount_vehicle",
  "trade_goods",
  "magic_item",
  "other",
] as const;

export const ITEM_RARITIES = [
  "common",
  "uncommon",
  "rare",
  "very_rare",
  "legendary",
  "artifact",
  "varies",
] as const;

export const WEAPON_PROPERTIES = [
  "ammunition",
  "finesse",
  "heavy",
  "light",
  "loading",
  "reach",
  "special",
  "thrown",
  "two-handed",
  "versatile",
] as const;

// ---------------------------------------------------------------------------
// Properties sub-schemas
// ---------------------------------------------------------------------------

export const weaponPropertiesSchema = z.object({
  damage: z.string().default(""),
  damageType: z.string().default(""),
  versatileDamage: z.string().optional(),
  weaponCategory: z.enum(["simple", "martial"]).default("simple"),
  weaponRange: z.enum(["melee", "ranged"]).default("melee"),
  weaponProperties: z.array(z.string()).default([]),
  rangeNormal: z.number().optional(),
  rangeLong: z.number().optional(),
  throwRangeNormal: z.number().optional(),
  throwRangeLong: z.number().optional(),
});

export const armorPropertiesSchema = z.object({
  armorType: z.enum(["light", "medium", "heavy"]).default("light"),
  armorClass: z.number().int().default(11),
  dexBonus: z.boolean().default(true),
  maxDexBonus: z.number().nullable().default(null),
  strengthRequirement: z.number().int().default(0),
  stealthDisadvantage: z.boolean().default(false),
});

export const shieldPropertiesSchema = z.object({
  armorClass: z.number().int().default(2),
});

export const magicItemPropertiesSchema = z.object({
  requiresAttunement: z.boolean().default(false),
  attunementClasses: z.array(z.string()).default([]),
});

export const containerPropertiesSchema = z.object({
  capacity: z.number().int().positive().default(20),
  acceptsItemSlug: z.string(),
});

export const spellMaterialPropertiesSchema = z.object({
  aliases: z.array(z.string()).default([]),
  consumedByDefault: z.boolean().default(false),
});

export const QUIVER_ITEM_SLUG = "quiver";
export const CROSSBOW_BOLT_CASE_ITEM_SLUG = "case-crossbow";

const DEFAULT_AMMO_CONTAINER_PROPERTIES: Record<
  string,
  z.infer<typeof containerPropertiesSchema>
> = {
  [QUIVER_ITEM_SLUG]: { capacity: 20, acceptsItemSlug: "arrow" },
  [CROSSBOW_BOLT_CASE_ITEM_SLUG]: { capacity: 20, acceptsItemSlug: "crossbow-bolt" },
};

// ---------------------------------------------------------------------------
// Full item schema
// ---------------------------------------------------------------------------

export const itemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: z.enum(ITEM_CATEGORIES).default("other"),
  subcategory: z.string().nullable().optional(),
  source: z.string().default("SRD"),
  rarity: z.enum(ITEM_RARITIES).default("common"),
  weight_lb: z.number().nullable().optional(),
  cost_gp: z.number().nullable().optional(),
  description: z.string().default(""),
  properties: z.record(z.string(), z.unknown()).default({}),
  requires_attunement: z.boolean().default(false),
  is_magic: z.boolean().default(false),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const newItemSchema = itemSchema.omit({ id: true, created_at: true, updated_at: true });

export type Item = z.infer<typeof itemSchema>;
export type NewItem = z.infer<typeof newItemSchema>;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];
export type ItemRarity = (typeof ITEM_RARITIES)[number];

// ---------------------------------------------------------------------------
// Typed property helpers
// ---------------------------------------------------------------------------

export type WeaponProperties = z.infer<typeof weaponPropertiesSchema>;
export type ArmorProperties = z.infer<typeof armorPropertiesSchema>;
export type ShieldProperties = z.infer<typeof shieldPropertiesSchema>;
export type ContainerProperties = z.infer<typeof containerPropertiesSchema>;
export type SpellMaterialProperties = z.infer<typeof spellMaterialPropertiesSchema>;

export function getWeaponProperties(item: Item): WeaponProperties | null {
  if (item.category !== "weapon") return null;
  const result = weaponPropertiesSchema.safeParse(item.properties);
  return result.success ? result.data : null;
}

export function getArmorProperties(item: Item): ArmorProperties | null {
  if (item.category !== "armor") return null;
  const result = armorPropertiesSchema.safeParse(item.properties);
  return result.success ? result.data : null;
}

export function getShieldProperties(item: Item): ShieldProperties | null {
  if (item.category !== "shield") return null;
  const result = shieldPropertiesSchema.safeParse(item.properties);
  return result.success ? result.data : null;
}

export function getContainerProperties(item: Item): ContainerProperties | null {
  const result = containerPropertiesSchema.safeParse(item.properties);
  if (result.success) return result.data;
  return DEFAULT_AMMO_CONTAINER_PROPERTIES[item.slug] ?? null;
}

export function getSpellMaterialProperties(item: Item): SpellMaterialProperties | null {
  const raw = item.properties.spellMaterial;
  if (!raw) return null;
  const result = spellMaterialPropertiesSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function isCostlySpellMaterialItem(item: Item): boolean {
  return (item.cost_gp ?? 0) > 0;
}

/** Build tooltip text with item stats and description. */
export function formatItemCostGp(costGp: number): string {
  const cost = costGp % 1 === 0 ? String(costGp) : costGp.toFixed(2);
  return `${cost} gp`;
}

export function formatItemTooltip(item: Item): string | null {
  const lines: string[] = [];

  const name = item.name.trim();
  if (name) {
    lines.push(name);
  }

  const weapon = getWeaponProperties(item);
  if (weapon) {
    if (weapon.damage) {
      lines.push(
        `Damage: ${weapon.damage}${weapon.damageType ? ` ${weapon.damageType}` : ""}`
      );
    }
    if (weapon.versatileDamage) {
      lines.push(`Versatile: ${weapon.versatileDamage}`);
    }
    lines.push(`${weapon.weaponCategory} ${weapon.weaponRange}`);
    if (weapon.weaponProperties.length) {
      lines.push(`Properties: ${weapon.weaponProperties.join(", ")}`);
    }
    if (weapon.rangeNormal != null) {
      const range =
        weapon.rangeLong != null
          ? `${weapon.rangeNormal}/${weapon.rangeLong} ft`
          : `${weapon.rangeNormal} ft`;
      lines.push(`Range: ${range}`);
    }
    if (weapon.throwRangeNormal != null) {
      const range =
        weapon.throwRangeLong != null
          ? `${weapon.throwRangeNormal}/${weapon.throwRangeLong} ft`
          : `${weapon.throwRangeNormal} ft`;
      lines.push(`Thrown: ${range}`);
    }
  }

  const armor = getArmorProperties(item);
  if (armor) {
    lines.push(`AC: ${armor.armorClass} (${armor.armorType})`);
    if (!armor.dexBonus) {
      lines.push("No Dex bonus");
    } else if (armor.maxDexBonus != null) {
      lines.push(`Max Dex: +${armor.maxDexBonus}`);
    }
    if (armor.strengthRequirement > 0) {
      lines.push(`Str ${armor.strengthRequirement} required`);
    }
    if (armor.stealthDisadvantage) {
      lines.push("Stealth disadvantage");
    }
  }

  const shield = getShieldProperties(item);
  if (shield) {
    lines.push(`AC: +${shield.armorClass}`);
  }

  if (!weapon && !armor && !shield && item.category !== "other") {
    lines.push(categoryLabel(item.category));
  }

  if (item.weight_lb != null && item.weight_lb > 0) {
    lines.push(`Weight: ${item.weight_lb} lb`);
  }
  if (item.slug === BACKPACK_ITEM_SLUG) {
    lines.push(`Carry capacity: +${BACKPACK_CARRY_CAPACITY_BONUS_LB} lb`);
  }
  const container = getContainerProperties(item);
  if (container) {
    lines.push(`Capacity: ${container.capacity} ${container.acceptsItemSlug.replace(/-/g, " ")}`);
  }
  if (item.cost_gp != null && item.cost_gp > 0) {
    lines.push(`Value: ${formatItemCostGp(item.cost_gp)}`);
  }
  if (item.is_magic && item.rarity !== "common") {
    lines.push(rarityLabel(item.rarity));
  }
  if (item.requires_attunement) {
    lines.push("Requires attunement");
  }

  const description = item.description.trim();
  if (description) {
    if (lines.length) lines.push("");
    lines.push(description);
  }

  return lines.length ? lines.join("\n") : null;
}

export function isWeapon(item: Item): boolean {
  return item.category === "weapon";
}

export function isArmor(item: Item): boolean {
  return item.category === "armor" || item.category === "shield";
}

/** Human-readable label for an item category. */
export function categoryLabel(category: ItemCategory): string {
  const labels: Record<ItemCategory, string> = {
    weapon: "Weapon",
    armor: "Armor",
    shield: "Shield",
    adventuring_gear: "Adventuring Gear",
    tool: "Tool",
    ammunition: "Ammunition",
    focus: "Spellcasting Focus",
    pack: "Pack",
    mount_vehicle: "Mount / Vehicle",
    trade_goods: "Trade Goods",
    magic_item: "Magic Item",
    other: "Other",
  };
  return labels[category] ?? category;
}

export function weaponCategoryLabel(category: "simple" | "martial" | string): string {
  if (category === "simple") return "Simple";
  if (category === "martial") return "Martial";
  return category;
}

export function weaponRangeLabel(range: "melee" | "ranged" | string): string {
  if (range === "melee") return "Melee";
  if (range === "ranged") return "Ranged";
  return range;
}

export function armorTypeLabel(type: "light" | "medium" | "heavy" | string): string {
  if (type === "light") return "Light";
  if (type === "medium") return "Medium";
  if (type === "heavy") return "Heavy";
  return type;
}

/** Human-readable label for rarity. */
export function rarityLabel(rarity: ItemRarity): string {
  const labels: Record<ItemRarity, string> = {
    common: "Common",
    uncommon: "Uncommon",
    rare: "Rare",
    very_rare: "Very Rare",
    legendary: "Legendary",
    artifact: "Artifact",
    varies: "Varies",
  };
  return labels[rarity] ?? rarity;
}

export const RARITY_COLOR: Record<ItemRarity, string> = {
  common: "text-foreground",
  uncommon: "text-green-600 dark:text-green-400",
  rare: "text-blue-600 dark:text-blue-400",
  very_rare: "text-purple-600 dark:text-purple-400",
  legendary: "text-orange-500 dark:text-orange-400",
  artifact: "text-red-600 dark:text-red-400",
  varies: "text-muted-foreground",
};

export type InventoryItemCategory = ItemCategory;

export function resolveInventoryItemCategory(
  item: InventoryItem,
  catalogItem: Item | null | undefined
): InventoryItemCategory {
  if (!item.itemId || !catalogItem) return "adventuring_gear";
  return catalogItem.category;
}

/** Light background + border tint for inventory cards on the character sheet. */
export const INVENTORY_ITEM_CATEGORY_CLASS: Record<InventoryItemCategory, string> = {
  weapon:
    "bg-rose-500/10 border-rose-200/50 dark:bg-rose-950/40 dark:border-rose-800/50",
  armor:
    "bg-sky-500/10 border-sky-200/50 dark:bg-sky-950/40 dark:border-sky-800/50",
  shield:
    "bg-indigo-500/10 border-indigo-200/50 dark:bg-indigo-950/40 dark:border-indigo-800/50",
  adventuring_gear:
    "bg-amber-500/10 border-amber-200/50 dark:bg-amber-950/40 dark:border-amber-800/50",
  tool:
    "bg-emerald-500/10 border-emerald-200/50 dark:bg-emerald-950/40 dark:border-emerald-800/50",
  ammunition:
    "bg-zinc-500/10 border-zinc-200/50 dark:bg-zinc-950/40 dark:border-zinc-700/50",
  focus:
    "bg-violet-500/10 border-violet-200/50 dark:bg-violet-950/40 dark:border-violet-800/50",
  pack:
    "bg-orange-500/10 border-orange-200/50 dark:bg-orange-950/40 dark:border-orange-800/50",
  mount_vehicle:
    "bg-cyan-500/10 border-cyan-200/50 dark:bg-cyan-950/40 dark:border-cyan-800/50",
  trade_goods:
    "bg-yellow-500/10 border-yellow-200/50 dark:bg-yellow-950/40 dark:border-yellow-800/50",
  magic_item:
    "bg-fuchsia-500/10 border-fuchsia-200/50 dark:bg-fuchsia-950/40 dark:border-fuchsia-800/50",
  other: "bg-muted/30 border-border",
};

export function getInventoryItemCategoryClass(
  item: InventoryItem,
  catalogItem: Item | null | undefined
): string {
  return INVENTORY_ITEM_CATEGORY_CLASS[resolveInventoryItemCategory(item, catalogItem)];
}

/** Subcategory options grouped by item category (used in admin + character creation filters). */
export const ITEM_SUBCATEGORY_OPTIONS: Partial<
  Record<ItemCategory, Array<{ value: string; label: string; hint?: string }>>
> = {
  weapon: [
    { value: "simple_melee", label: "Simple melee" },
    { value: "simple_ranged", label: "Simple ranged" },
    { value: "martial_melee", label: "Martial melee" },
    { value: "martial_ranged", label: "Martial ranged" },
  ],
  armor: [
    { value: "light_armor", label: "Light armor" },
    { value: "medium_armor", label: "Medium armor" },
    { value: "heavy_armor", label: "Heavy armor" },
  ],
  tool: [
    {
      value: "artisans_tools",
      label: "Artisan's tools",
      hint: "Shows in “Choose artisan's tools” during character creation",
    },
    {
      value: "musical_instrument",
      label: "Musical instrument",
      hint: "Shows in musical instrument pickers",
    },
    {
      value: "gaming_set",
      label: "Gaming set",
      hint: "Shows in gaming set pickers",
    },
    {
      value: "kit",
      label: "Kit",
      hint: "Thieves' tools, disguise kit, herbalism kit, etc.",
    },
    {
      value: "explorer_tools",
      label: "Explorer's tools",
      hint: "Cartographer's or navigator's tools",
    },
  ],
};

const SUBCATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(ITEM_SUBCATEGORY_OPTIONS)
    .flat()
    .map(({ value, label }) => [value, label])
);

/** Human-readable label for an item subcategory slug. */
export function subcategoryLabel(subcategory: string | null | undefined): string {
  if (!subcategory) return "";
  return SUBCATEGORY_LABELS[subcategory] ?? subcategory.replace(/_/g, " ");
}

export function subcategoryOptionsForCategory(
  category: ItemCategory
): Array<{ value: string; label: string; hint?: string }> {
  return ITEM_SUBCATEGORY_OPTIONS[category] ?? [];
}
