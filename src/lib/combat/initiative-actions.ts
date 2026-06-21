"use server";

import { getCampaignAccess } from "@/lib/auth/campaign-access";
import { prepareCharacterDataForSave } from "@/lib/character/save-character-data";
import { parseCharacterData } from "@/lib/schemas/character";
import { createClient } from "@/lib/supabase/server";

export async function submitInitiativeRoll(
  campaignId: string,
  characterId: string,
  roll: number
): Promise<{ error?: string }> {
  if (!Number.isFinite(roll) || roll < 1 || roll > 20) {
    return { error: "Enter a d20 roll from 1 to 20." };
  }

  const access = await getCampaignAccess(campaignId);
  if (!access?.user) {
    return { error: "You must be signed in to submit initiative." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_player_initiative_roll", {
    p_campaign_id: campaignId,
    p_character_id: characterId,
    p_roll: roll,
  });

  if (error) {
    return { error: error.message };
  }

  return {};
}

export async function clearCampaignInitiativeRolls(
  campaignId: string,
  characterIds: string[]
): Promise<{ error?: string }> {
  const access = await getCampaignAccess(campaignId);
  if (!access?.isDm) {
    return { error: "Only the DM can reset initiative rolls." };
  }

  if (characterIds.length === 0) return {};

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("characters")
    .select("id, data")
    .eq("campaign_id", campaignId)
    .in("id", characterIds);

  if (error) return { error: error.message };

  await Promise.all(
    (rows ?? []).map(async (row) => {
      const data = parseCharacterData(row.data);
      if (!data.combat.pendingInitiativeRoll) return;

      const nextData = prepareCharacterDataForSave({
        ...data,
        combat: {
          ...data.combat,
          pendingInitiativeRoll: null,
        },
      });

      await supabase.from("characters").update({ data: nextData }).eq("id", row.id);
    })
  );

  return {};
}
