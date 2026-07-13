import { Suspense } from "react";
import { requireCampaignAccess } from "@/lib/auth/campaign-access";
import { parseCharacterRow } from "@/lib/character/utils";
import { fetchCatalogClasses } from "@/lib/content/catalog";
import { parseCombatState } from "@/lib/schemas/combat-state";
import { parseWorldData } from "@/lib/schemas/world";
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

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("combat_state")
    .eq("id", campaignId)
    .single();

  const characters = (rows ?? []).map((row) =>
    parseCharacterRow(row as Character, access.isDm)
  );
  const classes = await fetchCatalogClasses();

  return (
    <Suspense fallback={<p className="retro-note">Loading characters…</p>}>
      <CharacterSheetsList
        campaignId={campaignId}
        initialCharacters={characters}
        classes={classes}
        isDm={access.isDm}
        userId={access.user?.id ?? null}
        initialWorldData={parseWorldData(access.campaign.world_data)}
        ownedCharacterId={access.ownedCharacter?.id ?? null}
        initialCombatState={parseCombatState(campaign?.combat_state ?? {})}
      />
    </Suspense>
  );
}
