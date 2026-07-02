import { getCampaignAccess } from "@/lib/auth/campaign-access";
import { CampaignNotebookTab } from "@/components/character/campaign-notebook-tab";
import { parseSoulmongerData } from "@/lib/schemas/soulmonger";

export default async function CampaignNotebookPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const access = await getCampaignAccess(campaignId);
  if (!access) return null;

  return (
    <>
      <h2 className="page-title">Notebook</h2>
      <section className="retro-box">
        <CampaignNotebookTab
          campaignId={campaignId}
          userId={access.user?.id ?? null}
          canUseNotebook={access.canUseNotebook}
          isDm={access.isDm}
          initialSoulmongerData={parseSoulmongerData(
            access.campaign.soulmonger_data
          )}
        />
      </section>
    </>
  );
}
