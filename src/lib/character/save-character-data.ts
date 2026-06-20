import type { CharacterData } from "@/lib/schemas/character";
import { clampInspiration } from "@/lib/dnd/calculations";
import { syncAcFromEquipment } from "@/lib/character/ac-derivation";
import { syncCombatDerivedStats } from "@/lib/character/combat-derivation";
import { sanitizeEquippedItems } from "@/lib/character/equip-rules";
import { syncSavingThrowsFromClass, resolveCharacterClass } from "@/lib/character/class-derivation";
import { stripGrantedFeaturesForSave } from "@/lib/character/feature-derivation";
import { syncFeatureGrants } from "@/lib/character/feature-grant-sync";
import { syncSpellcastingFromClass } from "@/lib/dnd/spellcasting";
import { levelFromXp } from "@/lib/dnd/xp";
import { createClient } from "@/lib/supabase/client";
import type { PhbClass } from "@/lib/dnd/phb/types";

export interface SaveCharacterOptions {
  /** When false, inspiration is preserved from originalData instead of data. */
  isDm?: boolean;
  originalData?: CharacterData;
}

/** Normalize derived fields before persisting character JSON. */
export function prepareCharacterDataForSave(
  data: CharacterData,
  classes?: PhbClass[],
  options?: SaveCharacterOptions
): CharacterData {
  const savingThrows = syncSavingThrowsFromClass(data, classes);
  const inventory = {
    ...data.inventory,
    items: sanitizeEquippedItems(
      data.inventory.items,
      {},
      data.basicInfo.species
    ),
  };
  const stripped = stripGrantedFeaturesForSave(
    { ...data, savingThrows, inventory },
    { classes }
  );
  const granted = syncFeatureGrants(stripped, { classes });
  const cls = resolveCharacterClass(granted, classes);
  const level = levelFromXp(granted.basicInfo.xp ?? 0);
  const withSpells = cls?.spellcasting
    ? { ...granted, spells: syncSpellcastingFromClass(granted, cls, level) }
    : granted;
  const syncedAc = syncAcFromEquipment(withSpells, {}, classes);
  const synced = syncCombatDerivedStats(syncedAc, classes);
  const inspirationSource = options?.isDm
    ? synced.inspiration ?? 0
    : options?.originalData?.inspiration ?? synced.inspiration ?? 0;

  return {
    ...synced,
    inspiration: clampInspiration(inspirationSource, synced),
  };
}

export async function saveCharacterData(
  characterId: string,
  data: CharacterData,
  classes?: PhbClass[],
  options?: SaveCharacterOptions
): Promise<{ error?: string }> {
  const supabase = createClient();
  const synced = prepareCharacterDataForSave(data, classes, options);
  const { error } = await supabase
    .from("characters")
    .update({
      data: synced,
      name: synced.basicInfo.name,
      player_name: synced.basicInfo.playerName,
    })
    .eq("id", characterId);

  return { error: error?.message };
}
