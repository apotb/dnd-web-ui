import { requireCampaignAccess } from "@/lib/auth/campaign-access";
import { createClient } from "@/lib/supabase/server";
import { EncounterList } from "@/components/combat/encounter-list";
import type { Encounter } from "@/lib/types/database";

export default async function CombatPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const access = await requireCampaignAccess(campaignId);
  const supabase = await createClient();

  const { data: encounters } = await supabase
    .from("encounters")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("updated_at", { ascending: false });

  return (
    <EncounterList
      campaignId={campaignId}
      encounters={(encounters ?? []) as Encounter[]}
      isDm={access.isDm}
    />
  );
}
