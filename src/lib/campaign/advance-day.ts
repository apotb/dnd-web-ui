import { addDays } from "@/lib/dnd/harptos-calendar";
import { parseCharacterData } from "@/lib/schemas/character";
import { syncCombatDerivedStats } from "@/lib/character/combat-derivation";
import { processEndOfDaySurvival } from "@/lib/dnd/survival";
import {
  getCampaignCalendarDate,
  type WorldData,
} from "@/lib/schemas/world";
import type { SupabaseClient } from "@supabase/supabase-js";

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
  worldData: WorldData
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
    data = processEndOfDaySurvival(data, endingDate, worldData);
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
