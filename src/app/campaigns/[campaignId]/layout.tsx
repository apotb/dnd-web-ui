import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCampaignAccess } from "@/lib/auth/campaign-access";
import { parseCharacterRow } from "@/lib/character/utils";
import { parseWorldData } from "@/lib/schemas/world";
import { CampaignNav } from "@/components/layout/campaign-nav";
import { CampaignNotifications } from "@/components/layout/campaign-notifications";
import { RetroShell } from "@/components/layout/retro-shell";
import type { Character } from "@/lib/types/database";

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

  const supabase = await createClient();
  let initialOwnedCharacter = null;
  if (access.ownedCharacter) {
    const { data: row } = await supabase
      .from("characters")
      .select("*")
      .eq("id", access.ownedCharacter.id)
      .single();
    if (row) {
      initialOwnedCharacter = parseCharacterRow(row as Character, access.isDm);
    }
  }

  return (
    <div className="campaign-page-frame">
      <RetroShell>
        <CampaignNav
          campaignId={campaignId}
          campaignName={access.campaign.name}
          userEmail={access.user?.email ?? null}
          isDm={access.isDm}
        />
        {children}
      </RetroShell>
      <CampaignNotifications
        campaignId={campaignId}
        userId={access.user?.id ?? null}
        ownedCharacterId={access.ownedCharacter?.id ?? null}
        initialCharacter={initialOwnedCharacter}
        initialWorldData={parseWorldData(access.campaign.world_data)}
        isDm={access.isDm}
      />
    </div>
  );
}
