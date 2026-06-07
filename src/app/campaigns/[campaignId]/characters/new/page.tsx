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
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Create Character</h1>
      <NewCharacterForm campaignId={campaignId} />
    </div>
  );
}
