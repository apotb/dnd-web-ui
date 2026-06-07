import {
  characterDataSchema,
  stripDmNotesFromCharacterData,
  type CharacterData,
} from "@/lib/schemas/character";
import {
  combatantDataSchema,
  stripDmNotesFromCombatantData,
  type CombatantData,
} from "@/lib/schemas/combat";
import type { Character, EncounterCombatant } from "@/lib/types/database";

export type ParsedCharacter = Omit<Character, "data"> & { data: CharacterData };
export type ParsedCombatant = Omit<EncounterCombatant, "data"> & {
  data: CombatantData;
};

export function parseCharacterRow(row: Character, isDm: boolean): ParsedCharacter {
  const data = characterDataSchema.parse(row.data ?? {});
  return {
    ...row,
    data: isDm ? data : stripDmNotesFromCharacterData(data),
  };
}

export function parseCombatantRow(
  row: EncounterCombatant,
  isDm: boolean
): ParsedCombatant {
  const data = combatantDataSchema.parse(row.data);
  return {
    ...row,
    data: isDm ? data : stripDmNotesFromCombatantData(data),
  };
}

export function syncCharacterTopLevelFields(
  name: string,
  playerName: string,
  data: CharacterData
): CharacterData {
  return {
    ...data,
    basicInfo: {
      ...data.basicInfo,
      name: name || data.basicInfo.name,
      playerName: playerName || data.basicInfo.playerName,
    },
  };
}
