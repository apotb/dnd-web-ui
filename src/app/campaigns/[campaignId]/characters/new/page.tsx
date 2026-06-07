import { redirect } from "next/navigation";
import { requireDm } from "@/lib/auth/campaign-access";
import { NewCharacterForm } from "@/components/character/new-character-form";

export default async function NewCharacterPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  await requireDm(campaignId);

  return (
    <div>
      <h2 className="page-title">Create Character</h2>
      <NewCharacterForm campaignId={campaignId} />
    </div>
  );
}
