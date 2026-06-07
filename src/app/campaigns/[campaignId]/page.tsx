import { createClient } from "@/lib/supabase/server";
import { getCampaignAccess } from "@/lib/auth/campaign-access";
import { parseCharacterRow } from "@/lib/character/utils";
import { parsePartyData } from "@/lib/schemas/party";
import { CampaignOverview } from "@/components/campaign/campaign-overview";
import type { Character } from "@/lib/types/database";

export default async function CampaignHomePage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const access = await getCampaignAccess(campaignId);
  if (!access) return null;

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("characters")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("name");

  const characters = (rows ?? []).map((row) =>
    parseCharacterRow(row as Character, access.isDm)
  );

  return (
    <CampaignOverview
      campaignId={campaignId}
      initialPartyData={parsePartyData(access.campaign.party_data)}
      initialCharacters={characters}
      isDm={access.isDm}
    />
  );
}
