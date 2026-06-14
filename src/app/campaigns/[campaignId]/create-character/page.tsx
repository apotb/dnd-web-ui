import { CharacterCreator } from "@/components/character-creator/character-creator";
import { CreatorIntroModal } from "@/components/character-creator/creator-intro-modal";
import { fetchCatalog } from "@/lib/content/catalog";

export default async function CreateCharacterPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const catalog = await fetchCatalog();

  return (
    <div>
      <CreatorIntroModal campaignId={campaignId} />
      <h2 className="page-title">New Character</h2>
      <CharacterCreator campaignId={campaignId} catalog={catalog} />
    </div>
  );
}
