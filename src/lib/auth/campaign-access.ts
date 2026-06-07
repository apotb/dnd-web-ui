import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Campaign, CampaignRole } from "@/lib/types/database";

export interface CampaignAccess {
  campaign: Campaign;
  isDm: boolean;
  role: CampaignRole | null;
}

export async function getCampaignAccess(
  campaignId: string
): Promise<CampaignAccess | null> {
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (!campaign) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { campaign, isDm: false, role: null };
  }

  const { data: membership } = await supabase
    .from("campaign_members")
    .select("role")
    .eq("campaign_id", campaignId)
    .eq("user_id", user.id)
    .maybeSingle();

  const role = (membership?.role as CampaignRole) ?? null;

  return {
    campaign,
    isDm: role === "dm",
    role,
  };
}

export async function requireCampaignAccess(
  campaignId: string
): Promise<CampaignAccess> {
  const access = await getCampaignAccess(campaignId);
  if (!access) notFound();
  return access;
}

export async function requireDm(campaignId: string): Promise<CampaignAccess> {
  const access = await requireCampaignAccess(campaignId);
  if (!access.isDm) redirect(`/campaigns/${campaignId}`);
  return access;
}

export async function getIsDmLoggedIn(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const dmEmail = process.env.DM_EMAIL?.trim().toLowerCase();
  if (dmEmail && user.email?.toLowerCase() !== dmEmail) return false;

  return true;
}
