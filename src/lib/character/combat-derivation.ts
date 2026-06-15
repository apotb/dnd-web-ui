import { findSpeciesByDisplayName } from "@/lib/content/catalog-tooltip";
import type { CharacterData } from "@/lib/schemas/character";
import type { PhbSpecies } from "@/lib/dnd/phb/types";
import { abilityModifier, formatModifier } from "@/lib/dnd/calculations";

/** Base walking speed from species (and subspecies), ignoring encumbrance. */
export function getSpeciesSpeedFromCharacter(
  data: CharacterData,
  speciesList: PhbSpecies[]
): number {
  const match = findSpeciesByDisplayName(data.basicInfo.species, speciesList);
  if (!match) return data.combat.speed || 30;

  const { species, subspecies } = match;
  if (species.id === "elf" && subspecies?.id === "wood") return 35;
  if (species.id === "genasi" && subspecies?.id === "water") return 30;
  return species.speed;
}

export function getInitiativeTotal(data: CharacterData): number {
  return abilityModifier(data.abilityScores.dex) + (data.combat.initiativeBonus ?? 0);
}

export function formatInitiativeTooltip(data: CharacterData): string {
  const dexMod = abilityModifier(data.abilityScores.dex);
  const bonus = data.combat.initiativeBonus ?? 0;
  const parts = [`DEX ${formatModifier(dexMod)}`];
  if (bonus !== 0) parts.push(`Bonus ${formatModifier(bonus)}`);
  return parts.join(" · ");
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
  amount: number
): Pick<CharacterData["combat"], "currentHp"> {
  if (amount <= 0) return { currentHp: combat.currentHp };
  return {
    currentHp: Math.min(combat.maxHp, combat.currentHp + amount),
  };
}
