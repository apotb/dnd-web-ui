import { CharacterCreator } from "@/components/character-creator/character-creator";

export default async function CreateCharacterPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  return (
    <div>
      <h2 className="page-title">Create Character</h2>
      <p className="retro-note">
        Build a 1st-level PHB character with point buy. Download JSON when finished — your DM
        can import it from the Characters tab.
      </p>
      <CharacterCreator campaignId={campaignId} />
    </div>
  );
}
