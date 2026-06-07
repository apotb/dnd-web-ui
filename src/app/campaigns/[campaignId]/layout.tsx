import { notFound } from "next/navigation";
import { requireCampaignContext } from "@/lib/auth/campaign-access";
import { CampaignNav } from "@/components/layout/campaign-nav";

export default async function CampaignLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const ctx = await requireCampaignContext(campaignId);

  if (!ctx) notFound();

  return (
    <>
      <CampaignNav
        campaignId={campaignId}
        campaignName={ctx.campaign.name}
        isDm={ctx.isDm}
      />
      <main className="mx-auto w-full max-w-6xl flex-1 p-4">{children}</main>
    </>
  );
}
