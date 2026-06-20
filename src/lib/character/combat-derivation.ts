import { findSpeciesByDisplayName } from "@/lib/content/catalog-tooltip";
import { resolveCharacterClass } from "@/lib/character/class-derivation";
import {
  ENCUMBERED_SPEED_FT,
  type EncumbranceInfo,
} from "@/lib/character/encumbrance";
import type { CharacterData } from "@/lib/schemas/character";
import { PHB_SPECIES } from "@/lib/dnd/phb/species";
import type { PhbClass, PhbSpecies } from "@/lib/dnd/phb/types";
import { abilityModifier, formatModifier } from "@/lib/dnd/calculations";
import {
  applyExhaustionToSpeed,
  getExhaustionMaxHpSheetNote,
  getExhaustionModifiers,
  getExhaustionSpeedSheetNote,
} from "@/lib/dnd/exhaustion";
import { levelFromXp } from "@/lib/dnd/xp";

export interface CombatStatSource {
  label: string;
  value: number;
}

export interface MaxHpBreakdown {
  total: number;
  sources: CombatStatSource[];
}

export interface SpeedBreakdown {
  effectiveSpeedFt: number;
  sources: CombatStatSource[];
}

function resolveSpeciesList(speciesList?: PhbSpecies[]): PhbSpecies[] {
  return speciesList?.length ? speciesList : PHB_SPECIES;
}

function getSpeciesSpeedSourceLabel(
  data: CharacterData,
  speciesList: PhbSpecies[]
): string {
  const match = findSpeciesByDisplayName(data.basicInfo.species, speciesList);
  if (match?.subspecies) return match.subspecies.name;
  if (match?.species) return match.species.name;
  const trimmed = data.basicInfo.species.trim();
  return trimmed || "Species";
}

/** Base walking speed from species (and subspecies), ignoring encumbrance. */
export function getSpeciesSpeedFromCharacter(
  data: CharacterData,
  speciesList: PhbSpecies[]
): number {
  const match = findSpeciesByDisplayName(
    data.basicInfo.species,
    resolveSpeciesList(speciesList)
  );
  if (!match) return data.combat.speed || 30;

  const { species, subspecies } = match;
  if (species.id === "elf" && subspecies?.id === "wood") return 35;
  if (species.id === "genasi" && subspecies?.id === "water") return 30;
  return species.speed;
}

export function calculateSpeedBreakdown(
  data: CharacterData,
  encumbranceInfo: EncumbranceInfo,
  speciesList?: PhbSpecies[]
): SpeedBreakdown {
  const pool = resolveSpeciesList(speciesList);
  const baseSpeedFt = getSpeciesSpeedFromCharacter(data, pool);
  const sourceLabel = getSpeciesSpeedSourceLabel(data, pool);
  const sources: CombatStatSource[] = [{ label: sourceLabel, value: baseSpeedFt }];

  const exhaustionSpeed = applyExhaustionToSpeed(baseSpeedFt, data);
  const exhaustionMods = getExhaustionModifiers(data);
  if (exhaustionMods.speedMultiplier !== 1) {
    sources.push({ label: "Exhaustion", value: exhaustionSpeed });
  }

  if (encumbranceInfo.status !== "normal") {
    sources.push({ label: "Encumbered", value: ENCUMBERED_SPEED_FT });
  }
  return {
    effectiveSpeedFt: encumbranceInfo.effectiveSpeedFt,
    sources,
  };
}

export function formatSpeedTooltip(
  breakdown: SpeedBreakdown,
  data?: CharacterData,
  baseSpeedFt?: number
): string | null {
  if (!breakdown.sources.length) return null;
  const lines = breakdown.sources
    .filter((source) => source.label !== "Exhaustion")
    .map((source) => {
      if (source.label === "Encumbered") {
        return `${source.label}: Max ${source.value} ft`;
      }
      return `${source.label}: ${source.value} ft`;
    });
  if (data != null) {
    const base =
      baseSpeedFt ??
      breakdown.sources.find((source) => source.label !== "Encumbered")?.value ??
      0;
    const note = getExhaustionSpeedSheetNote(base, data);
    if (note) lines.push(note);
  }
  return lines.join("\n");
}

/** Species-granted HP at 1st level (level-up bonuses handled separately later). */
export function getSpeciesHpBonus(
  data: CharacterData,
  speciesList?: PhbSpecies[]
): { bonus: number; label?: string } {
  const match = findSpeciesByDisplayName(
    data.basicInfo.species,
    resolveSpeciesList(speciesList)
  );
  if (match?.species.id === "dwarf" && match.subspecies?.id === "hill") {
    return { bonus: 1, label: "Hill Dwarf (Dwarven Toughness)" };
  }
  return { bonus: 0 };
}

/** Level-1 max HP from class hit die, Constitution, and species bonuses. */
export function calculateMaxHpBreakdown(
  data: CharacterData,
  catalogClasses?: PhbClass[],
  speciesList?: PhbSpecies[]
): MaxHpBreakdown {
  const cls = resolveCharacterClass(data, catalogClasses);
  const hitDie = cls?.hitDie ?? 8;
  const conMod = abilityModifier(data.abilityScores.con);
  const speciesBonus = getSpeciesHpBonus(data, speciesList);

  const sources: CombatStatSource[] = [
    { label: "Hit die", value: hitDie },
    { label: "Constitution", value: conMod },
  ];
  if (speciesBonus.bonus !== 0 && speciesBonus.label) {
    sources.push({ label: speciesBonus.label, value: speciesBonus.bonus });
  }

  const total = Math.max(1, hitDie + conMod + speciesBonus.bonus);
  return { total, sources };
}

export function applyExhaustionToMaxHpBreakdown(
  base: MaxHpBreakdown,
  data: CharacterData
): MaxHpBreakdown {
  const mods = getExhaustionModifiers(data);
  if (mods.maxHpMultiplier === 1) return base;

  if (mods.maxHpMultiplier === 0) {
    return {
      total: 0,
      sources: [...base.sources, { label: "Exhaustion (death)", value: 0 }],
    };
  }

  const halved = Math.floor(base.total / 2);
  return {
    total: halved,
    sources: [...base.sources, { label: "Exhaustion", value: halved }],
  };
}

export function calculateEffectiveMaxHpBreakdown(
  data: CharacterData,
  catalogClasses?: PhbClass[],
  speciesList?: PhbSpecies[]
): MaxHpBreakdown {
  return applyExhaustionToMaxHpBreakdown(
    calculateMaxHpBreakdown(data, catalogClasses, speciesList),
    data
  );
}

export function formatMaxHpTooltip(
  breakdown: MaxHpBreakdown,
  data?: CharacterData,
  baseMaxHp?: number
): string | null {
  if (!breakdown.sources.length) return null;
  const lines = breakdown.sources
    .filter((source) => !source.label.startsWith("Exhaustion"))
    .map((source) => {
      if (source.label === "Hit die") {
        return `${source.label}: d${source.value}`;
      }
      return `${source.label}: ${source.value >= 0 ? "+" : ""}${source.value}`;
    });
  if (data != null && baseMaxHp != null) {
    const note = getExhaustionMaxHpSheetNote(baseMaxHp, data);
    if (note) lines.push(note);
  }
  return lines.join("\n");
}

/** Total hit dice pool (e.g. `5d10`); spent dice tracked separately later. */
export function getHitDicePool(
  data: CharacterData,
  catalogClasses?: PhbClass[],
  level?: number
): string {
  const cls = resolveCharacterClass(data, catalogClasses);
  const hitDie = cls?.hitDie ?? 8;
  const lvl = level ?? levelFromXp(data.basicInfo.xp ?? 0);
  return `${lvl}d${hitDie}`;
}

export function formatHitDiceTooltip(
  data: CharacterData,
  catalogClasses?: PhbClass[]
): string | null {
  const cls = resolveCharacterClass(data, catalogClasses);
  if (!cls) return null;
  return `${cls.name}: d${cls.hitDie}`;
}

export function getInitiativeTotal(data: CharacterData): number {
  return abilityModifier(data.abilityScores.dex) + (data.combat.initiativeBonus ?? 0);
}

export function formatInitiativeTooltip(data: CharacterData): string {
  const dexMod = abilityModifier(data.abilityScores.dex);
  const bonus = data.combat.initiativeBonus ?? 0;
  const parts = [`Dexterity: ${formatModifier(dexMod)}`];
  if (bonus !== 0) parts.push(`Bonus: ${formatModifier(bonus)}`);
  return parts.join("\n");
}

/** Sync stored max HP, hit dice, cap current HP, and exhaustion level from stack. */
export function syncCombatDerivedStats(
  data: CharacterData,
  catalogClasses?: PhbClass[],
  speciesList?: PhbSpecies[]
): CharacterData {
  const { total: maxHp } = calculateEffectiveMaxHpBreakdown(
    data,
    catalogClasses,
    speciesList
  );
  const hitDice = getHitDicePool(data, catalogClasses);
  const pool = resolveSpeciesList(speciesList);
  const speed = getSpeciesSpeedFromCharacter(data, pool);
  const currentHp = Math.min(data.combat.currentHp, maxHp);
  const exhaustion = data.exhaustionLevels.length;
  return {
    ...data,
    combat: {
      ...data.combat,
      maxHp,
      hitDice,
      speed,
      currentHp,
      exhaustion,
    },
  };
}

/** Apply damage: temp HP absorbs first, then current HP (minimum 0). */
export function applyHpDamage(
  combat: CharacterData["combat"],
  amount: number
): Pick<CharacterData["combat"], "currentHp" | "tempHp"> {
  if (amount <= 0) return { currentHp: combat.currentHp, tempHp: combat.tempHp };

  let remaining = amount;
  let tempHp = combat.tempHp;
  let currentHp = combat.currentHp;

  if (tempHp > 0) {
    const absorbed = Math.min(tempHp, remaining);
    tempHp -= absorbed;
    remaining -= absorbed;
  }

  currentHp = Math.max(0, currentHp - remaining);
  return { currentHp, tempHp };
}

/** Heal current HP up to max HP (temp HP unchanged). */
export function applyHpHeal(
  combat: CharacterData["combat"],
  amount: number,
  maxHp?: number
): Pick<CharacterData["combat"], "currentHp"> {
  if (amount <= 0) return { currentHp: combat.currentHp };
  const cap = maxHp ?? combat.maxHp;
  return {
    currentHp: Math.min(cap, combat.currentHp + amount),
  };
}
