import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getIsDmLoggedIn } from "@/lib/auth/campaign-access";
import { CreateCampaignForm } from "@/components/campaign/create-campaign-form";
import { DmLoginInline } from "@/components/layout/dm-login-inline";
import { RetroShell } from "@/components/layout/retro-shell";

export default async function HomePage() {
  const campaignId = process.env.NEXT_PUBLIC_CAMPAIGN_ID;

  if (campaignId) {
    redirect(`/campaigns/${campaignId}`);
  }

  const supabase = await createClient();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name")
    .order("created_at", { ascending: false });

  const list = campaigns ?? [];

  if (list.length === 1) {
    redirect(`/campaigns/${list[0].id}`);
  }

  const isDm = await getIsDmLoggedIn();

  return (
    <RetroShell>
      <div className="retro-header-row">
        <span className="retro-title">dnd-web-ui</span>
        <DmLoginInline isDm={isDm} />
      </div>

      <div className="retro-spacer-lg" />

      {list.length > 1 ? (
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
      ) : (
        isDm && <CreateCampaignForm />
      )}
    </RetroShell>
  );
}
