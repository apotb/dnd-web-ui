import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CampaignList } from "./campaign-list";
import { CreateCampaignForm } from "@/components/campaign/create-campaign-form";

export const metadata = { title: "Admin — dnd-web-ui" };

async function getIsDm(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return false;
  const { data } = await supabase
    .from("campaign_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "dm")
    .limit(1)
    .maybeSingle();
  return !!data;
}

export default async function AdminPage() {
  const isDm = await getIsDm();
  if (!isDm) redirect("/");

  const supabase = await createClient();

  // Fetch all campaigns
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, is_main")
    .order("created_at", { ascending: false });

  // Count characters per campaign (players claim characters; campaign_members only has the DM)
  const { data: charCounts } = await supabase
    .from("characters")
    .select("campaign_id");

  const countByCampaign = (charCounts ?? []).reduce<Record<string, number>>(
    (acc, row) => {
      acc[row.campaign_id] = (acc[row.campaign_id] ?? 0) + 1;
      return acc;
    },
    {}
  );

  const rows = (campaigns ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    is_main: (c as unknown as { is_main: boolean }).is_main ?? false,
    characterCount: countByCampaign[c.id] ?? 0,
  }));

  async function setMainCampaign(campaignId: string | null): Promise<void> {
    "use server";
    const supabase = await createClient();
    // Clear current main
    await supabase
      .from("campaigns")
      .update({ is_main: false } as never)
      .eq("is_main", true as never);
    // Set new main
    if (campaignId) {
      await supabase
        .from("campaigns")
        .update({ is_main: true } as never)
        .eq("id", campaignId);
    }
  }

  return (
    <>
      <h1 className="page-title">Campaigns</h1>
      <CampaignList campaigns={rows} onSetMain={setMainCampaign} />
      <h2 className="page-title">Create New Campaign</h2>
      <CreateCampaignForm />
    </>
  );
}
