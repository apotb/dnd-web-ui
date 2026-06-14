import { z } from "zod";

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
