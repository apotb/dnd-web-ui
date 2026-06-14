import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/campaign-access";
import { CreateCampaignForm } from "@/components/campaign/create-campaign-form";
import { CampaignAuthHeader } from "@/components/layout/campaign-auth-header";
import { RetroShell } from "@/components/layout/retro-shell";
import Link from "next/link";

export default async function HomePage() {
  // Env-var override takes highest priority (legacy support)
  const envCampaignId = process.env.NEXT_PUBLIC_CAMPAIGN_ID;
  if (envCampaignId) {
    redirect(`/campaigns/${envCampaignId}`);
  }

  const supabase = await createClient();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, is_main")
    .order("created_at", { ascending: false });

  const list = (campaigns ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    is_main: (c as unknown as { is_main?: boolean }).is_main ?? false,
  }));

  // Redirect to the designated main campaign if one is set
  const mainCampaign = list.find((c) => c.is_main);
  if (mainCampaign) {
    redirect(`/campaigns/${mainCampaign.id}`);
  }

  const user = await getAuthUser();
  const isDm = user
    ? await (async () => {
        const { data } = await supabase
          .from("campaign_members")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "dm")
          .limit(1)
          .maybeSingle();
        return !!data;
      })()
    : false;

  return (
    <RetroShell>
      <div className="retro-header-row">
        <span className="retro-title">dnd-web-ui</span>
        <CampaignAuthHeader userEmail={user?.email ?? null} />
      </div>

      <div className="retro-spacer-lg" />

      {list.length > 0 && (
        <div className="retro-box">
          <p className="retro-box-subtitle" style={{ marginTop: 0 }}>Campaigns</p>
          <div className="candy-btn-row">
            {list.map((campaign) => (
              <Link
                key={campaign.id}
                href={`/campaigns/${campaign.id}`}
                className="candy-btn"
              >
                {campaign.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {user && list.length === 0 && (
        <div className="retro-box">
          <p className="retro-box-subtitle" style={{ marginTop: 0 }}>Create Campaign</p>
          <CreateCampaignForm />
        </div>
      )}

      {isDm && (
        <div className="candy-btn-row">
          <Link href="/admin" className="candy-btn">
            DM Admin →
          </Link>
        </div>
      )}
    </RetroShell>
  );
}
