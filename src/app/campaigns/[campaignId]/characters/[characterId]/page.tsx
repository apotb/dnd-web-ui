import { notFound } from "next/navigation";
import { getCharacterAccess } from "@/lib/auth/campaign-access";
import { parseCharacterRow } from "@/lib/character/utils";
import { fetchCatalogClasses } from "@/lib/content/catalog";
import { parseCombatState } from "@/lib/schemas/combat-state";
import { parseWorldData } from "@/lib/schemas/world";
import { createClient } from "@/lib/supabase/server";
import type { Character } from "@/lib/types/database";
import { CharacterClaimBanner } from "@/components/character/character-claim-banner";
import { CharacterSheetViewer } from "@/components/character/character-sheet-viewer";
import { CharacterSheet } from "@/components/character/character-sheet";

export default async function CharacterDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string; characterId: string }>;
}) {
  const { campaignId, characterId } = await params;
  const access = await getCharacterAccess(campaignId, characterId);

  if (!access) notFound();

  const character = parseCharacterRow(access.character, access.isDm);
  const classes = await fetchCatalogClasses();
  const initialWorldData = parseWorldData(access.campaign.world_data);
  const supabase = await createClient();

  const [{ data: characterRows }, { data: campaign }] = await Promise.all([
    supabase.from("characters").select("*").eq("campaign_id", campaignId).order("name"),
    supabase.from("campaigns").select("combat_state").eq("id", campaignId).single(),
  ]);

  const initialPartyCharacters = (characterRows ?? []).map((row) =>
    parseCharacterRow(row as Character, access.isDm)
  );
  const combatState = parseCombatState(campaign?.combat_state ?? {});
  const layOnHandsCombatPreferred = combatState.tokens.some(
    (token) =>
      token.kind === "party" &&
      token.placed &&
      token.characterId === characterId
  );

  if (access.canEdit) {
    return (
      <>
        {access.canClaim ? (
          <CharacterClaimBanner
            characterId={character.id}
            characterName={character.name}
            campaignId={campaignId}
            isLoggedIn={!!access.user}
            canClaim={access.canClaim}
            isDm={access.isDm}
          />
        ) : null}
        <section className="retro-box character-sheet-wrap">
          <CharacterSheetViewer
            character={character}
            campaignId={campaignId}
            classes={classes}
            isDm={access.isDm}
            canEdit
            canDelete={access.isDm}
            initialWorldData={initialWorldData}
            ownedCharacterId={access.ownedCharacter?.id ?? null}
            initialPartyCharacters={initialPartyCharacters}
            layOnHandsCombatPreferred={layOnHandsCombatPreferred}
          />
        </section>
      </>
    );
  }

  return (
    <>
      <CharacterClaimBanner
        characterId={character.id}
        characterName={character.name}
        campaignId={campaignId}
        isLoggedIn={!!access.user}
        canClaim={access.canClaim}
        isDm={access.isDm}
      />
      <section className="retro-box character-sheet-wrap">
        <CharacterSheet
          data={character.data}
          isDm={false}
          editable={false}
          classes={classes}
          campaignId={campaignId}
          characterId={character.id}
        />
      </section>
    </>
  );
}
