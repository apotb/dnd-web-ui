import { isWornForAc } from "@/lib/character/equip-rules";
import { resolveCharacterClass } from "@/lib/character/class-derivation";
import { findSpeciesByDisplayName } from "@/lib/content/catalog-tooltip";
import { SKILL_ABILITY_MAP } from "@/lib/dnd/calculations";
import { CONDITION_CHECK_EFFECTS } from "@/lib/dnd/conditions";
import { getExhaustionModifiers } from "@/lib/dnd/exhaustion";
import { formatFavoredEnemyDisplay } from "@/lib/dnd/phb/favored-enemy-humanoids";
import { getRangerPicksFromChoices } from "@/lib/dnd/phb/ranger-feature-slots";
import type { PhbClass, PhbSpecies } from "@/lib/dnd/phb/types";
import { getCharacterLevel } from "@/lib/dnd/xp";
import { hasNaturalArmorSpecies } from "@/lib/dnd/phb/species-mechanics";
import type { AbilityKey, CharacterData, SkillKey } from "@/lib/schemas/character";
import { getArmorProperties, type Item } from "@/lib/schemas/item";

export type CheckRollMode = "advantage" | "disadvantage" | null;

export interface CheckRollSource {
  label: string;
  detail: string;
  mode: "advantage" | "disadvantage";
}

export interface CheckRollModeResult {
  mode: CheckRollMode;
  sources: CheckRollSource[];
}

export interface CheckRollModeOptions {
  catalogItems?: Record<string, Item>;
  speciesList?: PhbSpecies[];
  classCatalog?: PhbClass[];
}

const SUNLIGHT_SENSITIVITY_TRAIT = "Sunlight Sensitivity";

/** PHB armor stealth disadvantage by item name (fallback when catalog properties are unavailable). */
const LEGACY_ARMOR_STEALTH_DISADVANTAGE = new Set([
  "padded armor",
  "scale mail",
  "half plate",
  "ring mail",
  "chain mail",
  "splint armor",
  "plate armor",
]);

const INT_SKILLS: SkillKey[] = [
  "arcana",
  "history",
  "investigation",
  "nature",
  "religion",
];

function lookupLegacyStealthDisadvantage(name: string): boolean {
  const key = name.toLowerCase().trim();
  if (LEGACY_ARMOR_STEALTH_DISADVANTAGE.has(key)) return true;
  if (key.endsWith(" armour")) {
    const us = `${key.slice(0, -7)} armor`;
    return LEGACY_ARMOR_STEALTH_DISADVANTAGE.has(us);
  }
  return false;
}

function resolveEquippedStealthDisadvantageArmor(
  data: CharacterData,
  catalogItems: Record<string, Item>
): { name: string } | null {
  let best: { name: string; baseAc: number; stealthDisadvantage: boolean } | null = null;

  for (const inv of data.inventory.items) {
    const catalog = inv.itemId ? catalogItems[inv.itemId] : null;
    if (!isWornForAc(inv, catalog)) continue;

    const displayName = catalog?.name ?? inv.name;

    if (catalog) {
      const armorProps = getArmorProperties(catalog);
      if (armorProps) {
        if (hasNaturalArmorSpecies(data.basicInfo.species)) continue;
        if (!armorProps.stealthDisadvantage) continue;
        if (!best || armorProps.armorClass > best.baseAc) {
          best = {
            name: displayName,
            baseAc: armorProps.armorClass,
            stealthDisadvantage: true,
          };
        }
        continue;
      }
    }

    if (lookupLegacyStealthDisadvantage(displayName)) {
      const legacyAc =
        displayName.toLowerCase().includes("chain mail") ? 16 :
        displayName.toLowerCase().includes("plate") ? 18 :
        displayName.toLowerCase().includes("splint") ? 17 :
        displayName.toLowerCase().includes("ring mail") ? 14 :
        displayName.toLowerCase().includes("half plate") ? 15 :
        displayName.toLowerCase().includes("scale mail") ? 14 :
        11;
      if (!best || legacyAc > best.baseAc) {
        best = { name: displayName, baseAc: legacyAc, stealthDisadvantage: true };
      }
    }
  }

  return best ? { name: best.name } : null;
}

function hasSunlightSensitivity(
  data: CharacterData,
  speciesList: PhbSpecies[]
): boolean {
  const match = findSpeciesByDisplayName(data.basicInfo.species, speciesList);
  if (!match) return false;

  const traitNames = (match.species.traits ?? []).map((t) => t.name);
  if (traitNames.includes(SUNLIGHT_SENSITIVITY_TRAIT)) return true;

  const subExtras = match.subspecies?.extras ?? [];
  return subExtras.some((line) => line.includes(SUNLIGHT_SENSITIVITY_TRAIT));
}

function getFavoredEnemyLabels(data: CharacterData, classCatalog?: PhbClass[]): string[] {
  const classMatch = resolveCharacterClass(data, classCatalog);
  if (classMatch?.id !== "ranger") return [];

  const level = getCharacterLevel(data);
  const { enemyPicks } = getRangerPicksFromChoices(data.featureChoices, level);
  return enemyPicks
    .map((pick) => formatFavoredEnemyDisplay(pick.enemy, pick.humanoidSpecies))
    .filter((label) => label.trim().length > 0);
}

function appendSituational(detail: string, situational?: string): string {
  if (!situational) return detail;
  return `${detail} (${situational})`;
}

function collectUniversalSources(data: CharacterData): CheckRollSource[] {
  const sources: CheckRollSource[] = [];

  if (getExhaustionModifiers(data).abilityCheckDisadvantage) {
    sources.push({
      label: "Exhaustion",
      detail: "Disadvantage on ability checks",
      mode: "disadvantage",
    });
  }

  for (const slug of data.combat.conditions ?? []) {
    const effect = CONDITION_CHECK_EFFECTS[slug];
    if (!effect) continue;

    const conditionLabel = slug.charAt(0).toUpperCase() + slug.slice(1);

    if (effect.disadvantageAllChecks) {
      sources.push({
        label: conditionLabel,
        detail: appendSituational("Disadvantage on ability checks", effect.situational),
        mode: "disadvantage",
      });
    }
    if (effect.advantageAllChecks) {
      sources.push({
        label: conditionLabel,
        detail: appendSituational("Advantage on ability checks", effect.situational),
        mode: "advantage",
      });
    }
  }

  return sources;
}

function collectSkillSpecificSources(
  data: CharacterData,
  skill: SkillKey,
  options: CheckRollModeOptions
): CheckRollSource[] {
  const sources: CheckRollSource[] = [];
  const catalogItems = options.catalogItems ?? {};
  const speciesList = options.speciesList ?? [];

  if (skill === "stealth") {
    const armor = resolveEquippedStealthDisadvantageArmor(data, catalogItems);
    if (armor) {
      sources.push({
        label: armor.name,
        detail: "Disadvantage on Stealth checks",
        mode: "disadvantage",
      });
    }
  }

  if (skill === "perception" && hasSunlightSensitivity(data, speciesList)) {
    sources.push({
      label: SUNLIGHT_SENSITIVITY_TRAIT,
      detail:
        "Disadvantage on Perception checks that rely on sight in direct sunlight",
      mode: "disadvantage",
    });
  }

  const favoredEnemies = getFavoredEnemyLabels(data, options.classCatalog);
  if (favoredEnemies.length > 0) {
    const enemyList = favoredEnemies.join("; ");
    if (skill === "survival") {
      sources.push({
        label: "Favored Enemy",
        detail: `Advantage on Survival checks to track ${enemyList}`,
        mode: "advantage",
      });
    }
    if (INT_SKILLS.includes(skill)) {
      sources.push({
        label: "Favored Enemy",
        detail: `Advantage on Intelligence checks to recall information about ${enemyList}`,
        mode: "advantage",
      });
    }
  }

  return sources;
}

function collectAbilitySpecificSources(
  data: CharacterData,
  ability: AbilityKey,
  options: CheckRollModeOptions
): CheckRollSource[] {
  const sources: CheckRollSource[] = [];

  if (ability === "int") {
    const favoredEnemies = getFavoredEnemyLabels(data, options.classCatalog);
    if (favoredEnemies.length > 0) {
      sources.push({
        label: "Favored Enemy",
        detail: `Advantage on Intelligence checks to recall information about ${favoredEnemies.join("; ")}`,
        mode: "advantage",
      });
    }
  }

  return sources;
}

function collectCheckRollSources(
  data: CharacterData,
  target: { skill?: SkillKey; ability?: AbilityKey },
  options: CheckRollModeOptions
): CheckRollSource[] {
  const sources = collectUniversalSources(data);

  if (target.skill) {
    sources.push(...collectSkillSpecificSources(data, target.skill, options));
  } else if (target.ability) {
    sources.push(...collectAbilitySpecificSources(data, target.ability, options));
  }

  return sources;
}

export function resolveCheckRollMode(sources: CheckRollSource[]): CheckRollMode {
  const hasAdvantage = sources.some((s) => s.mode === "advantage");
  const hasDisadvantage = sources.some((s) => s.mode === "disadvantage");
  if (hasAdvantage && hasDisadvantage) return null;
  if (hasDisadvantage) return "disadvantage";
  if (hasAdvantage) return "advantage";
  return null;
}

export function formatCheckRollModeTooltip(result: CheckRollModeResult): string | null {
  if (!result.sources.length) return null;

  const header =
    result.mode === "advantage"
      ? "Advantage on this check"
      : result.mode === "disadvantage"
        ? "Disadvantage on this check"
        : "Advantage and disadvantage cancel out";

  const lines = result.sources.map((source) => `${source.label}: ${source.detail}`);
  return [header, ...lines].join("\n");
}

export function getSkillCheckRollMode(
  data: CharacterData,
  skill: SkillKey,
  options: CheckRollModeOptions = {}
): CheckRollModeResult {
  const sources = collectCheckRollSources(data, { skill }, options);
  return { mode: resolveCheckRollMode(sources), sources };
}

export function getAbilityCheckRollMode(
  data: CharacterData,
  ability: AbilityKey,
  options: CheckRollModeOptions = {}
): CheckRollModeResult {
  const sources = collectCheckRollSources(data, { ability }, options);
  return { mode: resolveCheckRollMode(sources), sources };
}

/** Convenience: roll mode for a skill's governing ability check (excludes skill-only sources like armor stealth). */
export function getGoverningAbilityCheckRollMode(
  data: CharacterData,
  skill: SkillKey,
  options: CheckRollModeOptions = {}
): CheckRollModeResult {
  return getAbilityCheckRollMode(data, SKILL_ABILITY_MAP[skill], options);
}
