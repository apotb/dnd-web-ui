import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCampaignAccess } from "@/lib/auth/campaign-access";
import { CampaignNav } from "@/components/layout/campaign-nav";
import { RetroShell } from "@/components/layout/retro-shell";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}): Promise<Metadata> {
  const { campaignId } = await params;
  const access = await getCampaignAccess(campaignId);
  if (!access) return { title: "dnd-web-ui" };

  return { title: access.campaign.name };
}

export default async function CampaignLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const access = await getCampaignAccess(campaignId);

  if (!access) notFound();

  return (
    <RetroShell>
      <CampaignNav
        campaignId={campaignId}
        campaignName={access.campaign.name}
        isDm={access.isDm}
      />
      {children}
    </RetroShell>
  );
}
