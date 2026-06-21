import { notFound } from "next/navigation";
import { getCharacterAccess } from "@/lib/auth/campaign-access";
import { parseCharacterRow } from "@/lib/character/utils";
import { fetchCatalogClasses } from "@/lib/content/catalog";
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
