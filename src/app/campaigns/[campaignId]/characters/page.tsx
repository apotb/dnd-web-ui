import { requireCampaignAccess } from "@/lib/auth/campaign-access";
import { parseCharacterRow } from "@/lib/character/utils";
import { createClient } from "@/lib/supabase/server";
import { CharacterSheetsList } from "@/components/character/character-sheets-list";
import type { Character } from "@/lib/types/database";

export default async function CharactersPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const access = await requireCampaignAccess(campaignId);
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("characters")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("name");

  const characters = (rows ?? []).map((row) =>
    parseCharacterRow(row as Character, access.isDm)
  );

  return (
    <CharacterSheetsList
      campaignId={campaignId}
      initialCharacters={characters}
      isDm={access.isDm}
      userId={access.user?.id ?? null}
    />
  );
}
