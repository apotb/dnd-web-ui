/**
 * Seed the items table from the D&D 5e SRD API (dnd5eapi.co).
 *
 * Usage:
 *   npm run seed:items                    # print SQL to stdout
 *   npm run seed:items -- --write         # write supabase/migrations/080_seed_srd_items.sql
 *
 * Requires network access to https://www.dnd5eapi.co
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const API_BASE = "https://www.dnd5eapi.co";

/** Slugs seeded or customized in local migrations — never overwrite from API. */
const SKIP_SLUGS = new Set([
  "signal-horn",
  "block-of-incense",
  "little-bag-of-sand",
  "empty-waterskin",
  "tej",
  "quiver",
  "case-crossbow",
]);

const MIGRATION_PATH = resolve(
  import.meta.dirname,
  "../supabase/migrations/080_seed_srd_items.sql"
);

interface ApiListResult {
  count: number;
  results: Array<{ index: string; name: string; url: string }>;
}

interface ApiEquipment {
  index: string;
  name: string;
  equipment_category?: { index: string; name: string };
  gear_category?: { index: string; name: string };
  tool_category?: { index: string; name: string };
  weapon_category?: string;
  weapon_range?: string;
  damage?: { damage_dice: string; damage_type: { name: string } };
  two_handed_damage?: { damage_dice: string; damage_type: { name: string } };
  range?: { normal: number; long: number | null };
  throw_range?: { normal: number; long: number };
  properties?: Array<{ index: string; name: string }>;
  armor_category?: string;
  armor_class?: { base: number; dex_bonus: boolean; max_bonus: number | null };
  str_minimum?: number;
  stealth_disadvantage?: boolean;
  weight?: number;
  cost?: { quantity: number; unit: string };
  desc?: string[];
}

interface ApiMagicItem {
  index: string;
  name: string;
  equipment_category?: { index: string; name: string };
  rarity?: { name: string };
  requires_attunement?: string | boolean;
  desc?: string[];
}

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

function costInGp(cost?: { quantity: number; unit: string }): number | null {
  if (!cost) return null;
  const { quantity, unit } = cost;
  switch (unit) {
    case "gp":
      return quantity;
    case "sp":
      return quantity / 10;
    case "cp":
      return quantity / 100;
    case "pp":
      return quantity * 10;
    default:
      return quantity;
  }
}

function mapRarity(rarity?: { name: string }): string {
  if (!rarity) return "common";
  return rarity.name.toLowerCase().replace(/ /g, "_");
}

function requiresAttunement(val?: string | boolean): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val !== "" && val.toLowerCase() !== "no";
  return false;
}

function mapToolSubcategory(toolCategory?: string): string | null {
  switch ((toolCategory ?? "").toLowerCase()) {
    case "artisans-tools":
      return "artisans_tools";
    case "gaming-sets":
      return "gaming_set";
    case "musical-instrument":
      return "musical_instrument";
    case "other":
      return "kit";
    default:
      return null;
  }
}

function equipmentToSql(eq: ApiEquipment): string | null {
  if (SKIP_SLUGS.has(eq.index)) return null;

  const slug = eq.index;
  const name = esc(eq.name);
  const weight = eq.weight ?? null;
  const cost = costInGp(eq.cost);
  const desc = esc((eq.desc ?? []).join(" ").trim());

  let category = "adventuring_gear";
  let subcategory: string | null = null;
  let properties: Record<string, unknown> = {};

  const eqCat = (eq.equipment_category?.index ?? "").toLowerCase();
  const gearCat = (eq.gear_category?.index ?? "").toLowerCase();

  if (eqCat === "weapon") {
    category = "weapon";
    const wCat = (eq.weapon_category ?? "simple").toLowerCase().includes("martial")
      ? "martial"
      : "simple";
    const wRange = (eq.weapon_range ?? "melee").toLowerCase().includes("ranged")
      ? "ranged"
      : "melee";
    subcategory = `${wCat}_${wRange}`;

    const weapProps = (eq.properties ?? []).map((p) => p.index);
    properties = {
      damage: eq.damage?.damage_dice ?? "",
      damageType: eq.damage?.damage_type?.name?.toLowerCase() ?? "",
      versatileDamage: eq.two_handed_damage?.damage_dice,
      weaponCategory: wCat,
      weaponRange: wRange,
      weaponProperties: weapProps,
      rangeNormal: eq.range?.normal ?? null,
      rangeLong: eq.range?.long ?? null,
      throwRangeNormal: eq.throw_range?.normal ?? null,
      throwRangeLong: eq.throw_range?.long ?? null,
    };
  } else if (eqCat === "armor") {
    if (eq.armor_category?.toLowerCase().includes("shield")) {
      category = "shield";
      properties = { armorClass: eq.armor_class?.base ?? 2 };
    } else {
      category = "armor";
      const armorType = (eq.armor_category ?? "light").toLowerCase();
      subcategory = `${armorType}_armor`;
      properties = {
        armorType,
        armorClass: eq.armor_class?.base ?? 10,
        dexBonus: eq.armor_class?.dex_bonus ?? false,
        maxDexBonus: eq.armor_class?.max_bonus ?? null,
        strengthRequirement: eq.str_minimum ?? 0,
        stealthDisadvantage: eq.stealth_disadvantage ?? false,
      };
    }
  } else if (gearCat === "ammunition") {
    category = "ammunition";
  } else if (gearCat === "standard-gear" || eqCat === "adventuring-gear") {
    category = "adventuring_gear";
  } else if (
    gearCat === "arcane-foci" ||
    gearCat === "druidic-foci" ||
    gearCat === "holy-symbols"
  ) {
    category = "focus";
  } else if (eqCat === "tools") {
    category = "tool";
    subcategory = mapToolSubcategory(eq.tool_category?.index);
  } else if (eqCat === "mounts-and-vehicles") {
    category = "mount_vehicle";
  } else if (eqCat === "trade-goods") {
    category = "trade_goods";
  } else if (gearCat === "equipment-packs") {
    category = "pack";
  }

  const propsJson = esc(JSON.stringify(properties));

  return (
    `INSERT INTO public.items (slug,name,category,subcategory,source,rarity,weight_lb,cost_gp,description,properties) VALUES ` +
    `('${slug}','${name}','${category}',${subcategory ? `'${subcategory}'` : "NULL"},'SRD','common',` +
    `${weight ?? "NULL"},${cost ?? "NULL"},'${desc}','${propsJson}') ` +
    `ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name,category=EXCLUDED.category,` +
    `subcategory=EXCLUDED.subcategory,weight_lb=EXCLUDED.weight_lb,cost_gp=EXCLUDED.cost_gp,` +
    `description=EXCLUDED.description,properties=EXCLUDED.properties,updated_at=now();`
  );
}

function magicItemToSql(mi: ApiMagicItem): string | null {
  if (SKIP_SLUGS.has(mi.index)) return null;

  const slug = mi.index;
  const name = esc(mi.name);
  const rarity = mapRarity(mi.rarity);
  const attunement = requiresAttunement(mi.requires_attunement);
  const desc = esc((mi.desc ?? []).slice(0, 3).join(" ").trim());
  const propsJson = esc(JSON.stringify({ requiresAttunement: attunement, attunementClasses: [] }));

  return (
    `INSERT INTO public.items (slug,name,category,source,rarity,description,properties,requires_attunement,is_magic) VALUES ` +
    `('${slug}','${name}','magic_item','SRD','${rarity}','${desc}','${propsJson}',${attunement},true) ` +
    `ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name,rarity=EXCLUDED.rarity,` +
    `description=EXCLUDED.description,properties=EXCLUDED.properties,` +
    `requires_attunement=EXCLUDED.requires_attunement,is_magic=EXCLUDED.is_magic,updated_at=now();`
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

async function main() {
  const writeMode = process.argv.includes("--write");
  const statements: string[] = [
    "-- SRD items seeded from dnd5eapi.co",
    "-- Generated by: npm run seed:items -- --write",
    "",
  ];

  let equipmentCount = 0;
  let magicCount = 0;
  let skipped = 0;

  process.stderr.write("Fetching equipment list...\n");
  const eqList = await fetchJson<ApiListResult>(`${API_BASE}/api/equipment`);
  process.stderr.write(`Found ${eqList.count} equipment items\n`);

  for (const { index, url } of eqList.results) {
    if (SKIP_SLUGS.has(index)) {
      skipped += 1;
      continue;
    }
    try {
      const eq = await fetchJson<ApiEquipment>(`${API_BASE}${url}`);
      const sql = equipmentToSql(eq);
      if (sql) {
        statements.push(sql);
        equipmentCount += 1;
      }
    } catch (e) {
      process.stderr.write(`  Skipping ${index}: ${e}\n`);
    }
  }

  process.stderr.write("Fetching magic items list...\n");
  const miList = await fetchJson<ApiListResult>(`${API_BASE}/api/magic-items`);
  process.stderr.write(`Found ${miList.count} magic items\n`);

  for (const { index, url } of miList.results) {
    if (SKIP_SLUGS.has(index)) {
      skipped += 1;
      continue;
    }
    try {
      const mi = await fetchJson<ApiMagicItem>(`${API_BASE}${url}`);
      const sql = magicItemToSql(mi);
      if (sql) {
        statements.push(sql);
        magicCount += 1;
      }
    } catch (e) {
      process.stderr.write(`  Skipping ${index}: ${e}\n`);
    }
  }

  const output = statements.join("\n") + "\n";
  process.stderr.write(
    `Done: ${equipmentCount} equipment, ${magicCount} magic items (${skipped} skipped)\n`
  );

  if (writeMode) {
    writeFileSync(MIGRATION_PATH, output, "utf8");
    process.stderr.write(`Wrote ${MIGRATION_PATH}\n`);
  } else {
    process.stdout.write(output);
  }
}

main().catch((e) => {
  process.stderr.write(`Error: ${e}\n`);
  process.exit(1);
});
