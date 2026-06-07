import type { CharacterCreatorState } from "@/lib/dnd/character-builder/types";
import type { PhbRace } from "./types";
import { getRace } from "./races";

function getSubrace(race: PhbRace, subraceId: string) {
  return race.subraces?.find((s) => s.id === subraceId);
}

export function getRaceSpeed(state: CharacterCreatorState): number {
  const race = getRace(state.raceId);
  if (!race) return 30;
  if (state.raceId === "elf" && state.subraceId === "wood") return 35;
  if (state.raceId === "genasi" && state.subraceId === "water") return 30;
  return race.speed;
}

export function getRaceArmorProficiencies(state: CharacterCreatorState): string[] {
  const race = getRace(state.raceId);
  if (!race) return [];
  const sub = getSubrace(race, state.subraceId);
  return [
    ...(race.armorProficiencies ?? []),
    ...(sub?.armorProficiencies ?? []),
  ];
}

export function getRaceWeaponProficiencies(state: CharacterCreatorState): string[] {
  const race = getRace(state.raceId);
  if (!race) return [];
  const sub = getSubrace(race, state.subraceId);
  return [
    ...(race.weaponProficiencies ?? []),
    ...(sub?.weaponProficiencies ?? []),
    ...state.raceWeaponChoices,
  ];
}

export function getRaceAcBonus(state: CharacterCreatorState): number {
  if (state.raceId === "warforged") return 1;
  return 0;
}

export function usesLizardfolkNaturalArmor(
  state: CharacterCreatorState,
  wearingArmor: boolean
): boolean {
  return state.raceId === "lizardfolk" && !wearingArmor;
}

export function usesTortleNaturalArmor(
  state: CharacterCreatorState,
  wearingArmor: boolean
): boolean {
  return state.raceId === "tortle" && !wearingArmor;
}
