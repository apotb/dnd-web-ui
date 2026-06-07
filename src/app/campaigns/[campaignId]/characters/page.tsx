import { requireCampaignContext } from "@/lib/auth/campaign-access";
import { parseCharacterRow } from "@/lib/character/utils";
import { createClient } from "@/lib/supabase/server";
import { CharacterListClient } from "@/components/character/character-list-client";
import type { Character } from "@/lib/types/database";
import type { ParsedCharacter } from "@/lib/character/utils";

export default async function CharactersPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const ctx = await requireCampaignContext(campaignId);
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("characters")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("name");

  const characters = (rows ?? []).map((row) =>
    parseCharacterRow(row as Character, ctx.isDm)
  );

  return (
    <CharacterListClient
      campaignId={campaignId}
      initialCharacters={characters}
      isDm={ctx.isDm}
    />
  );
}
