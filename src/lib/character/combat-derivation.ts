import { findSpeciesByDisplayName } from "@/lib/content/catalog-tooltip";
import { resolveCharacterClass } from "@/lib/character/class-derivation";
import {
  calculateCarryCapacityBreakdown,
  ENCUMBERED_SPEED_FT,
  getEncumbranceInfo,
  getInventoryWeightLb,
  type EncumbranceInfo,
} from "@/lib/character/encumbrance";
import {
  syncCombatAfterHpChange,
  ensureZeroHpDownedConditions,
  hasDeadCondition,
  DEAD_CONDITION_SLUG,
} from "@/lib/dnd/dying-state";
import { applyConditionSlugs } from "@/lib/dnd/conditions";
import { syncExhaustionCondition } from "@/lib/combat/combat-conditions";
import type { CharacterData } from "@/lib/schemas/character";
import type { Item } from "@/lib/schemas/item";
import { PHB_SPECIES } from "@/lib/dnd/phb/species";
import type { PhbClass, PhbSpecies } from "@/lib/dnd/phb/types";
import { abilityModifier, formatModifier } from "@/lib/dnd/calculations";
import { averageHitDieRoll } from "@/lib/dnd/level-up";
import {
  applyExhaustionToSpeed,
  getExhaustionMaxHpSheetNote,
  getExhaustionModifiers,
  getExhaustionSpeedSheetNote,
} from "@/lib/dnd/exhaustion";
import { getCharacterLevel } from "@/lib/dnd/xp";

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

/** Walking speed after exhaustion and encumbrance (matches the character sheet). */
export function getCharacterEffectiveSpeedFt(
  data: CharacterData,
  catalogItems: Record<string, Item> = {},
  speciesList?: PhbSpecies[]
): number {
  const pool = resolveSpeciesList(speciesList);
  const baseSpeedFt = getSpeciesSpeedFromCharacter(data, pool);
  const speedBeforeEncumbrance = applyExhaustionToSpeed(baseSpeedFt, data);
  const carryCapacityBreakdown = calculateCarryCapacityBreakdown(
    data.abilityScores.str,
    data.inventory.items,
    catalogItems
  );
  const encumbrance = getEncumbranceInfo(
    data.abilityScores.str,
    getInventoryWeightLb(data.inventory.items, catalogItems),
    speedBeforeEncumbrance,
    carryCapacityBreakdown
  );
  return calculateSpeedBreakdown(data, encumbrance, speciesList).effectiveSpeedFt;
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

/** Level-1 max HP from class hit die and species bonuses (excludes CON). */
export function calculateLevel1MaxHpBreakdown(
  data: CharacterData,
  catalogClasses?: PhbClass[],
  speciesList?: PhbSpecies[]
): MaxHpBreakdown {
  const cls = resolveCharacterClass(data, catalogClasses);
  const hitDie = cls?.hitDie ?? 8;
  const speciesBonus = getSpeciesHpBonus(data, speciesList);

  const sources: CombatStatSource[] = [{ label: "Hit die", value: hitDie }];
  if (speciesBonus.bonus !== 0 && speciesBonus.label) {
    sources.push({ label: speciesBonus.label, value: speciesBonus.bonus });
  }

  const total = Math.max(1, hitDie + speciesBonus.bonus);
  return { total, sources };
}

/** Average die-only HP gain per level after 1st (mean die roll rounded down). */
export function averageLevelUpHpGain(
  data: CharacterData,
  catalogClasses?: PhbClass[]
): number {
  const cls = resolveCharacterClass(data, catalogClasses);
  const hitDie = cls?.hitDie ?? 8;
  return averageHitDieRoll(hitDie);
}

/** Strip bundled CON modifier from legacy level-up HP gains (one-time migration). */
export function stripConFromLevelUpHpGains(
  gains: number[],
  conMod: number
): number[] {
  return gains.map((gain) => Math.max(1, gain - conMod));
}

/** Cumulative max HP including level-up gains after 1st level. */
export function calculateMaxHpBreakdown(
  data: CharacterData,
  catalogClasses?: PhbClass[],
  speciesList?: PhbSpecies[]
): MaxHpBreakdown {
  const level1 = calculateLevel1MaxHpBreakdown(data, catalogClasses, speciesList);
  const level = getCharacterLevel(data);
  const conMod = abilityModifier(data.abilityScores.con);
  const conTotal = conMod * level;
  const gains = data.combat.levelUpHpGains ?? [];
  const gainTotal = gains.reduce((sum, g) => sum + g, 0);

  const sources: CombatStatSource[] = [
    ...level1.sources,
    { label: "Constitution", value: conTotal },
  ];
  if (gains.length > 0) {
    sources.push({ label: "Level-up", value: gainTotal });
  }

  const total = Math.max(1, level1.total + conTotal + gainTotal);
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

/** Total hit dice in the pool (equals character level). */
export function getHitDiceTotal(
  data: CharacterData,
  catalogClasses?: PhbClass[],
  level?: number
): number {
  return level ?? getCharacterLevel(data);
}

export function getHitDieSides(
  data: CharacterData,
  catalogClasses?: PhbClass[]
): number {
  const cls = resolveCharacterClass(data, catalogClasses);
  return cls?.hitDie ?? 8;
}

export function getHitDiceRemaining(
  data: CharacterData,
  catalogClasses?: PhbClass[],
  level?: number
): number {
  const total = getHitDiceTotal(data, catalogClasses, level);
  const spent = data.combat.hitDiceSpent ?? 0;
  return Math.max(0, total - Math.min(spent, total));
}

/** Total hit dice pool label (e.g. `5d10`). */
export function getHitDicePool(
  data: CharacterData,
  catalogClasses?: PhbClass[],
  level?: number
): string {
  const hitDie = getHitDieSides(data, catalogClasses);
  const lvl = getHitDiceTotal(data, catalogClasses, level);
  return `${lvl}d${hitDie}`;
}

/** Remaining/total hit dice label (e.g. `3/5d10`). */
export function formatHitDiceDisplay(
  data: CharacterData,
  catalogClasses?: PhbClass[],
  level?: number
): string {
  const total = getHitDiceTotal(data, catalogClasses, level);
  const remaining = getHitDiceRemaining(data, catalogClasses, level);
  const hitDie = getHitDieSides(data, catalogClasses);
  return `${remaining}/${total}d${hitDie}`;
}

export function formatHitDiceTooltip(
  data: CharacterData,
  catalogClasses?: PhbClass[],
  level?: number
): string | null {
  const cls = resolveCharacterClass(data, catalogClasses);
  if (!cls) return null;
  const total = getHitDiceTotal(data, catalogClasses, level);
  const remaining = getHitDiceRemaining(data, catalogClasses, level);
  const lines = [
    `${cls.name}: d${cls.hitDie}`,
    `${remaining} remaining`,
    `${total} maximum`,
  ];
  return lines.join("\n");
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

export function formatDeathSavesTooltip(_data: CharacterData): string {
  return [
    "When you start your turn with 0 hit points, make a death saving throw (d20, no ability modifier).",
    "10 or higher: 1 success. 9 or lower: 1 failure.",
    "",
    "Natural 20: regain 1 HP and wake up; death saves reset.",
    "Natural 1: counts as 2 failures.",
    "",
    "3 successes: you become stable (unconscious at 0 HP, no more death saves until you take damage).",
    "3 failures: you die.",
    "",
    "Damage while at 0 HP: 1 automatic failure (2 if a critical hit).",
    "Any healing that restores HP ends the dying state and resets death saves to 0.",
    "",
    "While dying: you are unconscious; attack rolls against you have advantage; hits from within 5 ft of you are critical hits if the attacker can see you.",
    "",
    "An ally can use an action to try a DC 10 Wisdom (Medicine) check to stabilize you (no HP restored).",
  ].join("\n");
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
  const hitDiceTotal = getHitDiceTotal(data, catalogClasses);
  const hitDiceSpent = Math.min(data.combat.hitDiceSpent ?? 0, hitDiceTotal);
  const currentHp = Math.min(data.combat.currentHp, maxHp);
  const exhaustion = data.exhaustionLevels.length;
  let conditions = data.combat.conditions ?? [];
  if (hasDeadCondition(data.combat)) {
    conditions = ensureZeroHpDownedConditions(conditions);
    conditions = applyConditionSlugs(conditions, [DEAD_CONDITION_SLUG]);
  } else if (currentHp === 0) {
    conditions = ensureZeroHpDownedConditions(conditions);
  }
  conditions = syncExhaustionCondition(conditions, exhaustion);
  return {
    ...data,
    combat: {
      ...data.combat,
      maxHp,
      hitDice,
      hitDiceSpent,
      speed,
      currentHp,
      exhaustion,
      conditions,
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

/** Apply damage and sync dying / stable / wake state on character combat. */
export function applyCombatHpDamage(
  combat: CharacterData["combat"],
  amount: number,
  options?: { isCritical?: boolean }
): CharacterData["combat"] {
  const previousHp = combat.currentHp;
  const { currentHp, tempHp } = applyHpDamage(combat, amount);
  const damageToHp = Math.max(0, previousHp - currentHp);
  return syncCombatAfterHpChange(
    { ...combat, tempHp },
    currentHp,
    { previousHp, damageToHp, isCritical: options?.isCritical }
  );
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

/** Heal and sync dying / stable / wake state on character combat. */
export function applyCombatHpHeal(
  combat: CharacterData["combat"],
  amount: number,
  maxHp?: number
): CharacterData["combat"] {
  const previousHp = combat.currentHp;
  const { currentHp } = applyHpHeal(combat, amount, maxHp);
  return syncCombatAfterHpChange(combat, currentHp, { previousHp });
}

/** Apply a signed HP delta and sync dying state (for DM manual adjust). */
export function applyCombatHpDelta(
  combat: CharacterData["combat"],
  delta: number,
  maxHp?: number
): CharacterData["combat"] {
  if (delta < 0) {
    return applyCombatHpDamage(combat, -delta);
  }
  if (delta > 0) {
    return applyCombatHpHeal(combat, delta, maxHp);
  }
  return combat;
}
