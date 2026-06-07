import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CampaignContext, CampaignRole } from "@/lib/types/database";

export async function getCampaignContext(
  campaignId: string
): Promise<CampaignContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (!campaign) return null;

  const { data: membership } = await supabase
    .from("campaign_members")
    .select("role")
    .eq("campaign_id", campaignId)
    .eq("user_id", user.id)
    .single();

  if (!membership) return null;

  const role = membership.role as CampaignRole;

  return {
    campaign,
    role,
    isDm: role === "dm",
  };
}

export async function requireCampaignContext(
  campaignId: string
): Promise<CampaignContext> {
  const ctx = await getCampaignContext(campaignId);
  if (!ctx) notFound();
  return ctx;
}

export async function requireDm(campaignId: string): Promise<CampaignContext> {
  const ctx = await requireCampaignContext(campaignId);
  if (!ctx.isDm) redirect(`/campaigns/${campaignId}`);
  return ctx;
}
