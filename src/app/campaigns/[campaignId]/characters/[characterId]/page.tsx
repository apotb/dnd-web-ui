import { notFound } from "next/navigation";
import { requireCampaignContext } from "@/lib/auth/campaign-access";
import { parseCharacterRow } from "@/lib/character/utils";
import { createClient } from "@/lib/supabase/server";
import { CharacterEditor } from "@/components/character/character-editor";
import { CharacterSheet } from "@/components/character/character-sheet";
import type { Character } from "@/lib/types/database";

export default async function CharacterDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string; characterId: string }>;
}) {
  const { campaignId, characterId } = await params;
  const ctx = await requireCampaignContext(campaignId);
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("characters")
    .select("*")
    .eq("id", characterId)
    .eq("campaign_id", campaignId)
    .single();

  if (!row) notFound();

  const character = parseCharacterRow(row as Character, ctx.isDm);

  if (ctx.isDm) {
    return (
      <CharacterEditor
        characterId={character.id}
        campaignId={campaignId}
        initialName={character.name}
        initialPlayerName={character.player_name}
        initialData={character.data}
      />
    );
  }

  return (
    <CharacterSheet data={character.data} isDm={false} editable={false} />
  );
}
