import { resolveCharacterClass } from "@/lib/character/class-derivation";
import { findSpeciesByDisplayName } from "@/lib/content/catalog-tooltip";
import { getAllCharacterFeatIds } from "@/lib/character/character-feats";
import type { CharacterData } from "@/lib/schemas/character";
import { getWeaponProperties, type Item } from "@/lib/schemas/item";
import { ALL_SPECIES } from "@/lib/dnd/phb/species";
import type { PhbClass } from "@/lib/dnd/phb/types";
import { getCharacterLevel } from "@/lib/dnd/xp";

export interface NaturalAttackSpec {
  id: string;
  name: string;
  baseDice: string;
  damageType: string;
  proficient: boolean;
  /** Show in combat even when a main-hand weapon is wielded. */
  alwaysAvailable?: boolean;
  /** Appears in the bonus-action panel with attack rolls. */
  bonusActionOnly?: boolean;
  /** Uses monk Dex/martial-arts die when applicable. */
  isUnarmedStrike?: boolean;
  notes?: string;
}

export function resolveSpeciesMatch(
  character: CharacterData,
  speciesList = ALL_SPECIES
): ReturnType<typeof findSpeciesByDisplayName> {
  return findSpeciesByDisplayName(character.basicInfo.species, speciesList);
}

export function getMartialArtsDie(level: number): string {
  if (level >= 17) return "1d10";
  if (level >= 11) return "1d8";
  if (level >= 5) return "1d6";
  return "1d4";
}

export function hasMonkMartialArts(
  character: CharacterData,
  catalogClasses?: PhbClass[]
): boolean {
  return resolveCharacterClass(character, catalogClasses)?.id === "monk";
}

/** Martial-arts die replaces flat "1" damage; otherwise use the higher die face. */
export function resolveUnarmedDamageDie(baseDice: string, monkLevel: number | null): string {
  if (monkLevel == null) return baseDice;
  const martialDie = getMartialArtsDie(monkLevel);
  if (baseDice === "1") return martialDie;
  const baseFaces = parseDieFaces(baseDice);
  const martialFaces = parseDieFaces(martialDie);
  return martialFaces > baseFaces ? martialDie : baseDice;
}

function parseDieFaces(dice: string): number {
  const match = dice.match(/^\d+d(\d+)$/i);
  if (match) return parseInt(match[1], 10);
  return 0;
}

export function hasTavernBrawler(character: CharacterData): boolean {
  if (getAllCharacterFeatIds(character).includes("tavern-brawler")) return true;
  return character.features.some((f) => f.name.toLowerCase() === "tavern brawler");
}

/** Monk weapons: shortswords and simple melee weapons without heavy or two-handed. */
export function isMonkWeapon(catalogItem: Item): boolean {
  const wp = getWeaponProperties(catalogItem);
  if (!wp) return false;
  const slug = catalogItem.slug?.toLowerCase() ?? "";
  if (slug === "shortsword") return true;
  if (wp.weaponCategory !== "simple") return false;
  if (wp.weaponRange !== "melee") return false;
  if (wp.weaponProperties.includes("heavy")) return false;
  if (wp.weaponProperties.includes("two-handed")) return false;
  return true;
}

export function getNaturalAttackSpecs(
  character: CharacterData,
  catalogClasses?: PhbClass[]
): NaturalAttackSpec[] {
  const specs: NaturalAttackSpec[] = [];
  const match = resolveSpeciesMatch(character);
  const speciesId = match?.species.id;
  const subspeciesId = match?.subspecies?.id;

  let unarmedDice = "1";
  let unarmedType = "bludgeoning";
  let unarmedProficient = false;

  if (speciesId === "aarakocra" || speciesId === "tabaxi" || speciesId === "tortle") {
    unarmedDice = "1d4";
    unarmedType = "slashing";
    unarmedProficient = true;
  }

  specs.push({
    id: "unarmed-strike",
    name: "Unarmed Strike",
    baseDice: unarmedDice,
    damageType: unarmedType,
    proficient: unarmedProficient,
    isUnarmedStrike: true,
  });

  if (speciesId === "lizardfolk") {
    specs.push({
      id: "natural-bite",
      name: "Bite",
      baseDice: "1d6",
      damageType: "piercing",
      proficient: true,
      alwaysAvailable: true,
    });
    specs.push({
      id: "natural-bite-bonus",
      name: "Bite (Hungry Jaws)",
      baseDice: "1d6",
      damageType: "piercing",
      proficient: true,
      bonusActionOnly: true,
      notes: "Hungry Jaws",
    });
  }

  if (speciesId === "shifter" && subspeciesId === "longtooth") {
    specs.push({
      id: "natural-fangs-bonus",
      name: "Fangs",
      baseDice: "1d6",
      damageType: "piercing",
      proficient: true,
      bonusActionOnly: true,
      isUnarmedStrike: true,
      notes: "While shifted",
    });
  }

  if (hasMonkMartialArts(character, catalogClasses)) {
    specs.push({
      id: "unarmed-strike-bonus",
      name: "Unarmed Strike",
      baseDice: unarmedDice,
      damageType: unarmedType,
      proficient: true,
      bonusActionOnly: true,
      isUnarmedStrike: true,
      notes: "Martial Arts",
    });
  }

  return specs;
}

export { getCharacterLevel } from "@/lib/dnd/xp";
