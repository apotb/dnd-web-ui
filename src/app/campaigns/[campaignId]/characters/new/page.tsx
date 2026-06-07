import { redirect } from "next/navigation";

export default async function LegacyNewCharacterPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  redirect(`/campaigns/${campaignId}/create-character`);
}
