import type { CharacterData } from "@/lib/schemas/character";
import { syncAcFromEquipment } from "@/lib/character/ac-derivation";
import { sanitizeEquippedItems } from "@/lib/character/equip-rules";
import { syncSavingThrowsFromClass, resolveCharacterClass } from "@/lib/character/class-derivation";
import { stripGrantedFeaturesForSave } from "@/lib/character/feature-derivation";
import { syncFeatureGrants } from "@/lib/character/feature-grant-sync";
import { syncSpellcastingFromClass } from "@/lib/dnd/spellcasting";
import { levelFromXp } from "@/lib/dnd/xp";
import { createClient } from "@/lib/supabase/client";
import type { PhbClass } from "@/lib/dnd/phb/types";

/** Normalize derived fields before persisting character JSON. */
export function prepareCharacterDataForSave(
  data: CharacterData,
  classes?: PhbClass[]
): CharacterData {
  const savingThrows = syncSavingThrowsFromClass(data, classes);
  const inventory = {
    ...data.inventory,
    items: sanitizeEquippedItems(data.inventory.items),
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
  return syncAcFromEquipment(withSpells, {}, classes);
}

export async function saveCharacterData(
  characterId: string,
  data: CharacterData,
  classes?: PhbClass[]
): Promise<{ error?: string }> {
  const supabase = createClient();
  const synced = prepareCharacterDataForSave(data, classes);
  const { error } = await supabase
    .from("characters")
    .update({ data: synced })
    .eq("id", characterId);

  return { error: error?.message };
}
