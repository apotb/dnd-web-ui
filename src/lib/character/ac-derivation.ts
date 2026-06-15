import { isWornForAc } from "@/lib/character/equip-rules";
import type { CharacterData } from "@/lib/schemas/character";
import { resolveCharacterClass } from "@/lib/character/class-derivation";
import { getAbilityModifiers } from "@/lib/dnd/calculations";
import { hasNaturalArmorSpecies } from "@/lib/dnd/phb/species-mechanics";
import type { PhbClass } from "@/lib/dnd/phb/types";
import {
  getArmorProperties,
  getShieldProperties,
  type Item,
} from "@/lib/schemas/item";

export interface AcSource {
  label: string;
  value: number;
}

export interface AcBreakdown {
  total: number;
  sources: AcSource[];
}

/** PHB armor AC by item name (fallback when catalog properties are unavailable). */
const LEGACY_ARMOR_AC: Record<string, { base: number; maxDex?: number }> = {
  "padded armor": { base: 11, maxDex: 999 },
  "leather armor": { base: 11, maxDex: 999 },
  "studded leather armor": { base: 12, maxDex: 999 },
  "studded leather": { base: 12, maxDex: 999 },
  "hide armor": { base: 12, maxDex: 2 },
  "chain shirt": { base: 13, maxDex: 2 },
  "scale mail": { base: 14, maxDex: 2 },
  "breastplate": { base: 14, maxDex: 2 },
  "half plate": { base: 15, maxDex: 2 },
  "ring mail": { base: 14, maxDex: 0 },
  "chain mail": { base: 16, maxDex: 0 },
  "splint armor": { base: 17, maxDex: 0 },
  "plate armor": { base: 18, maxDex: 0 },
};

function lookupLegacyArmor(name: string) {
  const key = name.toLowerCase().trim();
  if (LEGACY_ARMOR_AC[key]) return LEGACY_ARMOR_AC[key];
  if (key.endsWith(" armour")) {
    const us = `${key.slice(0, -7)} armor`;
    if (LEGACY_ARMOR_AC[us]) return LEGACY_ARMOR_AC[us];
  }
  return null;
}

function resolveSpeciesId(species: string): string | null {
  const lower = species.toLowerCase().trim();
  if (lower.includes("lizardfolk")) return "lizardfolk";
  if (lower.includes("tortle")) return "tortle";
  if (lower.includes("warforged")) return "warforged";
  return null;
}

function pushSource(sources: AcSource[], label: string, value: number) {
  if (value === 0 && !["Base", "Unarmored Defense"].includes(label)) return;
  sources.push({ label, value });
}

function isShieldName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower === "shield" || lower.endsWith(" shield");
}

interface ResolvedArmor {
  name: string;
  base: number;
  maxDex: number | null;
  noDex: boolean;
}

function resolveEquippedGear(
  data: CharacterData,
  catalogItems: Record<string, Item>
): { armor: ResolvedArmor | null; shield: { name: string; bonus: number } | null } {
  let armor: ResolvedArmor | null = null;
  let shield: { name: string; bonus: number } | null = null;

  for (const inv of data.inventory.items) {
    const catalog = inv.itemId ? catalogItems[inv.itemId] : null;
    if (!isWornForAc(inv, catalog)) continue;

    const displayName = catalog?.name ?? inv.name;

    if (catalog) {
      const armorProps = getArmorProperties(catalog);
      if (armorProps) {
        if (hasNaturalArmorSpecies(data.basicInfo.species)) continue;
        const base = armorProps.armorClass;
        const noDex = !armorProps.dexBonus;
        const maxDex = noDex
          ? 0
          : armorProps.maxDexBonus != null
            ? armorProps.maxDexBonus
            : null;
        if (!armor || base > armor.base) {
          armor = { name: displayName, base, maxDex, noDex };
        }
        continue;
      }

      const shieldProps = getShieldProperties(catalog);
      if (shieldProps) {
        shield = { name: displayName, bonus: shieldProps.armorClass };
        continue;
      }
    }

    const legacy = lookupLegacyArmor(displayName);
    if (legacy) {
      if (hasNaturalArmorSpecies(data.basicInfo.species)) continue;
      const noDex = legacy.maxDex === 0;
      const maxDex =
        legacy.maxDex === 0
          ? 0
          : legacy.maxDex != null && legacy.maxDex < 999
            ? legacy.maxDex
            : null;
      if (!armor || legacy.base > armor.base) {
        armor = { name: displayName, base: legacy.base, maxDex, noDex };
      }
      continue;
    }

    if (isShieldName(displayName)) {
      shield = { name: displayName, bonus: 2 };
    }
  }

  return { armor, shield };
}

/** Compute AC and contributing sources from equipped gear, class, and species. */
export function calculateAcBreakdown(
  data: CharacterData,
  catalogItems: Record<string, Item> = {},
  catalogClasses?: PhbClass[]
): AcBreakdown {
  const mods = getAbilityModifiers(data.abilityScores);
  const dexMod = mods.dex;
  const conMod = mods.con;
  const wisMod = mods.wis;

  const { armor, shield } = resolveEquippedGear(data, catalogItems);
  const speciesId = resolveSpeciesId(data.basicInfo.species);
  const classId = resolveCharacterClass(data, catalogClasses)?.id;

  const sources: AcSource[] = [];
  let total: number;
  let allowShield = true;

  if (armor) {
    pushSource(sources, armor.name, armor.base);
    let dexBonus = 0;
    if (!armor.noDex) {
      dexBonus =
        armor.maxDex != null ? Math.min(dexMod, armor.maxDex) : dexMod;
      pushSource(sources, "Dexterity", dexBonus);
    }
    total = armor.base + dexBonus;
  } else if (speciesId === "lizardfolk") {
    pushSource(sources, "Natural armor", 13);
    pushSource(sources, "Dexterity", dexMod);
    total = 13 + dexMod;
  } else if (speciesId === "tortle") {
    pushSource(sources, "Natural armor", 17);
    total = 17;
  } else if (classId === "barbarian") {
    pushSource(sources, "Base", 10);
    pushSource(sources, "Dexterity", dexMod);
    pushSource(sources, "Constitution", conMod);
    total = 10 + dexMod + conMod;
  } else if (classId === "monk") {
    pushSource(sources, "Base", 10);
    pushSource(sources, "Dexterity", dexMod);
    pushSource(sources, "Wisdom", wisMod);
    total = 10 + dexMod + wisMod;
    allowShield = false;
  } else {
    pushSource(sources, "Base", 10);
    pushSource(sources, "Dexterity", dexMod);
    total = 10 + dexMod;
  }

  if (shield && allowShield) {
    pushSource(sources, shield.name, shield.bonus);
    total += shield.bonus;
  }

  if (speciesId === "warforged") {
    pushSource(sources, "Warforged", 1);
    total += 1;
  }

  return { total, sources };
}

export function formatAcTooltip(breakdown: AcBreakdown): string | null {
  if (!breakdown.sources.length) return null;
  const modLabels = new Set(["Dexterity", "Constitution", "Wisdom", "Warforged"]);
  return breakdown.sources
    .map((source) => {
      if (modLabels.has(source.label)) {
        return `${source.label}: ${source.value >= 0 ? "+" : ""}${source.value}`;
      }
      if (isShieldName(source.label)) {
        return `${source.label}: +${source.value}`;
      }
      return `${source.label}: ${source.value}`;
    })
    .join("\n");
}

/** Sync stored combat.ac from derived equipment rules (for saves and combat import). */
export function syncAcFromEquipment(
  data: CharacterData,
  catalogItems: Record<string, Item> = {},
  catalogClasses?: PhbClass[]
): CharacterData {
  const { total } = calculateAcBreakdown(data, catalogItems, catalogClasses);
  return {
    ...data,
    combat: { ...data.combat, ac: total },
  };
}
