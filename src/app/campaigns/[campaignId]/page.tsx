import Link from "next/link";
import { requireCampaignContext } from "@/lib/auth/campaign-access";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";

export default async function CampaignDashboardPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const ctx = await requireCampaignContext(campaignId);
  const supabase = await createClient();

  const [{ count: characterCount }, { data: activeEncounterRaw }] =
    await Promise.all([
      supabase
        .from("characters")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaignId),
      supabase
        .from("encounters")
        .select("id, name, round")
        .eq("campaign_id", campaignId)
        .eq("active", true)
        .maybeSingle(),
    ]);

  const activeEncounter = activeEncounterRaw as {
    id: string;
    name: string;
    round: number;
  } | null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{ctx.campaign.name}</h1>
        <p className="text-muted-foreground">
          {ctx.isDm
            ? "Dungeon Master view — you can edit characters and run combat."
            : "Player view — read-only character sheets and live combat."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Characters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-bold">{characterCount ?? 0}</p>
            <LinkButton href={`/campaigns/${campaignId}/characters`}>
              View Characters
            </LinkButton>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Combat</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeEncounter ? (
              <p className="text-sm">
                Active: {activeEncounter.name} (Round {activeEncounter.round})
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No active encounter
              </p>
            )}
            <LinkButton
              href={`/campaigns/${campaignId}/combat`}
              variant={activeEncounter ? "default" : "outline"}
            >
              {activeEncounter ? "Go to Combat" : "Combat Tracker"}
            </LinkButton>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
