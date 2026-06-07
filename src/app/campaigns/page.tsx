import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateCampaignForm } from "@/components/campaign/create-campaign-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import type { Campaign, CampaignMember } from "@/lib/types/database";

export default async function CampaignsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: memberships } = await supabase
    .from("campaign_members")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const memberRows = (memberships ?? []) as CampaignMember[];
  const campaignIds = memberRows.map((m) => m.campaign_id);

  let campaigns: Campaign[] = [];
  if (campaignIds.length > 0) {
    const { data: campaignRows } = await supabase
      .from("campaigns")
      .select("*")
      .in("id", campaignIds);
    campaigns = (campaignRows ?? []) as Campaign[];
  }

  const campaignById = new Map(campaigns.map((c) => [c.id, c]));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your Campaigns</h1>
        <p className="text-muted-foreground">
          Manage character sheets and combat for your table.
        </p>
      </div>

      <CreateCampaignForm />

      <div className="grid gap-3 sm:grid-cols-2">
        {memberRows.map((membership) => {
          const campaign = campaignById.get(membership.campaign_id);
          if (!campaign) return null;

          return (
            <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle className="text-lg">{campaign.name}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Role:{" "}
                  {membership.role === "dm" ? "Dungeon Master" : "Player"}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {memberRows.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No campaigns yet. Create one above to get started.
          </CardContent>
        </Card>
      )}

      <LinkButton variant="outline" href="/login">
        Account
      </LinkButton>
    </main>
  );
}
