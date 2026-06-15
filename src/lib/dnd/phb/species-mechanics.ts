import type { CharacterCreatorState } from "@/lib/dnd/character-builder/types";
import type { PhbSpecies } from "./types";
import { getSpecies } from "./species";

function getSubspecies(species: PhbSpecies, subspeciesId: string) {
  return species.subspecies?.find((s) => s.id === subspeciesId);
}

export function getSpeciesSpeed(state: CharacterCreatorState): number {
  const species = getSpecies(state.speciesId);
  if (!species) return 30;
  if (state.speciesId === "elf" && state.subspeciesId === "wood") return 35;
  if (state.speciesId === "genasi" && state.subspeciesId === "water") return 30;
  return species.speed;
}

export function getSpeciesArmorProficiencies(state: CharacterCreatorState): string[] {
  const species = getSpecies(state.speciesId);
  if (!species) return [];
  const sub = getSubspecies(species, state.subspeciesId);
  return [
    ...(species.armorProficiencies ?? []),
    ...(sub?.armorProficiencies ?? []),
  ];
}

export function getSpeciesWeaponProficiencies(state: CharacterCreatorState): string[] {
  const species = getSpecies(state.speciesId);
  if (!species) return [];
  const sub = getSubspecies(species, state.subspeciesId);
  return [
    ...(species.weaponProficiencies ?? []),
    ...(sub?.weaponProficiencies ?? []),
    ...state.speciesWeaponChoices,
  ];
}

export function getSpeciesAcBonus(state: CharacterCreatorState): number {
  if (state.speciesId === "warforged") return 1;
  return 0;
}

export function usesLizardfolkNaturalArmor(
  state: CharacterCreatorState,
  wearingArmor: boolean
): boolean {
  return state.speciesId === "lizardfolk" && !wearingArmor;
}

export function usesTortleNaturalArmor(
  state: CharacterCreatorState,
  wearingArmor: boolean
): boolean {
  return state.speciesId === "tortle" && !wearingArmor;
}

/** Lizardfolk and Tortle use natural armor instead of worn armor (shields still OK). */
export function hasNaturalArmorSpecies(speciesDisplayName: string): boolean {
  const lower = speciesDisplayName.toLowerCase();
  return lower.includes("lizardfolk") || lower.includes("tortle");
}
