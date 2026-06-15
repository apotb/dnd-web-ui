import { notFound } from "next/navigation";
import { getCharacterAccess } from "@/lib/auth/campaign-access";
import { parseCharacterRow } from "@/lib/character/utils";
import { fetchCatalogClasses } from "@/lib/content/catalog";
import { CharacterClaimBanner } from "@/components/character/character-claim-banner";
import { CharacterEditor } from "@/components/character/character-editor";
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

  if (access.canEdit) {
    return (
      <CharacterEditor
        characterId={character.id}
        campaignId={campaignId}
        initialName={character.name}
        initialPlayerName={character.player_name}
        initialData={character.data}
        classes={classes}
        canDelete={access.isDm}
        showDmNotes={access.isDm}
        showEditingNote={access.isOwner && !access.isDm}
      />
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
        isOwner={false}
      />
      <CharacterSheet
        data={character.data}
        isDm={false}
        editable={false}
        classes={classes}
        campaignId={campaignId}
        characterId={character.id}
      />
    </>
  );
}
