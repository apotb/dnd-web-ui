import { addDays, type HarptosDate } from "@/lib/dnd/harptos-calendar";
import { parseCharacterData, type CharacterData } from "@/lib/schemas/character";
import { syncCombatDerivedStats } from "@/lib/character/combat-derivation";
import {
  applyEndOfDaySuppliesChoice,
  getWaterGallonsFromEndOfDayChoice,
  type EndOfDaySuppliesChoice,
} from "@/lib/dnd/supplies";
import {
  needsDehydrationSaveForWaterGallons,
  previewExhaustionBeforeDehydration,
  processEndOfDaySurvival,
} from "@/lib/dnd/survival";
import {
  getCampaignCalendarDate,
  type WorldData,
} from "@/lib/schemas/world";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DmEndOfDaySuppliesByCharacterId = Record<
  string,
  EndOfDaySuppliesChoice
>;

export type DmEndOfDayDehydrationSaveRolls = Record<string, number>;

export function characterNeedsDehydrationSaveAfterSupplies(
  data: CharacterData,
  endingDate: HarptosDate,
  worldData: WorldData,
  suppliesChoice: EndOfDaySuppliesChoice
): boolean {
  if (!worldData.dailySuppliesActive) return false;

  const afterSupplies = applyEndOfDaySuppliesChoice(
    data,
    endingDate,
    worldData,
    suppliesChoice
  );
  const gallons = afterSupplies.supplies.waterGallonsToday;

  return needsDehydrationSaveForWaterGallons(gallons, worldData);
}

export function getDehydrationSavePreviewForSupplies(
  data: CharacterData,
  endingDate: HarptosDate,
  worldData: WorldData,
  suppliesChoice: EndOfDaySuppliesChoice
) {
  const afterSupplies = applyEndOfDaySuppliesChoice(
    data,
    endingDate,
    worldData,
    suppliesChoice
  );

  return {
    exhaustionBeforeCheck: previewExhaustionBeforeDehydration(
      afterSupplies,
      endingDate,
      worldData
    ),
    gallonsDrunk: getWaterGallonsFromEndOfDayChoice(suppliesChoice, worldData),
  };
}

export function buildNextWorldData(worldData: WorldData): WorldData {
  const today = getCampaignCalendarDate(worldData);
  return {
    ...worldData,
    calendar: addDays(today, 1),
    dailySuppliesActive: true,
  };
}

export async function advanceCampaignDay(
  supabase: SupabaseClient,
  campaignId: string,
  worldData: WorldData,
  dmSuppliesByCharacterId?: DmEndOfDaySuppliesByCharacterId,
  dehydrationSaveRolls?: DmEndOfDayDehydrationSaveRolls
): Promise<{ error?: string; nextWorldData?: WorldData }> {
  const endingDate = getCampaignCalendarDate(worldData);
  const nextWorldData = buildNextWorldData(worldData);

  const { data: rows, error: fetchError } = await supabase
    .from("characters")
    .select("id, data")
    .eq("campaign_id", campaignId);

  if (fetchError) {
    return { error: fetchError.message };
  }

  for (const row of rows ?? []) {
    let data = parseCharacterData(row.data);
    const suppliesChoice = dmSuppliesByCharacterId?.[row.id];
    if (suppliesChoice) {
      data = applyEndOfDaySuppliesChoice(
        data,
        endingDate,
        worldData,
        suppliesChoice
      );
    }
    data = processEndOfDaySurvival(data, endingDate, worldData, {
      dehydrationSaveRollTotal: dehydrationSaveRolls?.[row.id],
    });
    data = syncCombatDerivedStats(data);

    const { error: updateError } = await supabase
      .from("characters")
      .update({ data })
      .eq("id", row.id);

    if (updateError) {
      return { error: updateError.message };
    }
  }

  const { error: campaignError } = await supabase
    .from("campaigns")
    .update({ world_data: nextWorldData })
    .eq("id", campaignId);

  if (campaignError) {
    return { error: campaignError.message };
  }

  return { nextWorldData };
}
