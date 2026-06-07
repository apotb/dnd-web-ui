import { notFound } from "next/navigation";
import { requireCampaignAccess } from "@/lib/auth/campaign-access";
import { parseCharacterRow, parseCombatantRow } from "@/lib/character/utils";
import { createClient } from "@/lib/supabase/server";
import { CombatTrackerDm } from "@/components/combat/combat-tracker-dm";
import { CombatTrackerPlayer } from "@/components/combat/combat-tracker-player";
import type { Character, Encounter, EncounterCombatant } from "@/lib/types/database";

export default async function EncounterPage({
  params,
}: {
  params: Promise<{ campaignId: string; encounterId: string }>;
}) {
  const { campaignId, encounterId } = await params;
  const access = await requireCampaignAccess(campaignId);
  const supabase = await createClient();

  const { data: encounter } = await supabase
    .from("encounters")
    .select("*")
    .eq("id", encounterId)
    .eq("campaign_id", campaignId)
    .single();

  if (!encounter) notFound();

  const [{ data: combatantRows }, { data: characterRows }] = await Promise.all([
    supabase
      .from("encounter_combatants")
      .select("*")
      .eq("encounter_id", encounterId)
      .order("initiative", { ascending: false }),
    supabase
      .from("characters")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("name"),
  ]);

  const combatants = (combatantRows ?? []).map((row) =>
    parseCombatantRow(row as EncounterCombatant, access.isDm)
  );

  const characters = (characterRows ?? []).map((row) =>
    parseCharacterRow(row as Character, access.isDm)
  );

  if (access.isDm) {
    return (
      <CombatTrackerDm
        encounter={encounter as Encounter}
        combatants={combatants}
        characters={characters}
        campaignId={campaignId}
      />
    );
  }

  return (
    <CombatTrackerPlayer
      encounter={encounter as Encounter}
      combatants={combatants}
    />
  );
}
