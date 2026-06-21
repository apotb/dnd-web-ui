import { requireCampaignAccess } from "@/lib/auth/campaign-access";
import { parseCharacterRow, type ParsedCharacter } from "@/lib/character/utils";
import {
  createDefaultCombatState,
  normalizeCombatTokens,
  type EnemyRecord,
} from "@/lib/combat/state-utils";
import { CombatBoard } from "@/components/combat/combat-board";
import { parseCombatState } from "@/lib/schemas/combat-state";
import { parseEnemyData } from "@/lib/schemas/enemy";
import { createClient } from "@/lib/supabase/server";
import type { Character } from "@/lib/types/database";

export default async function CombatPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const access = await requireCampaignAccess(campaignId);
  const supabase = await createClient();

  const [{ data: campaign }, { data: characterRows }, { data: enemyRows }] =
    await Promise.all([
      supabase.from("campaigns").select("combat_state").eq("id", campaignId).single(),
      supabase.from("characters").select("*").eq("campaign_id", campaignId).order("name"),
      supabase.from("enemies").select("slug,name,data").order("name"),
    ]);

  const characters: ParsedCharacter[] = (characterRows ?? []).map((row) =>
    parseCharacterRow(row as Character, access.isDm)
  );

  let combatState = normalizeCombatTokens(parseCombatState(campaign?.combat_state ?? {}));
  if (combatState.tokens.filter((token) => token.kind === "party").length === 0) {
    combatState = createDefaultCombatState(characters);
  }

  const enemies: EnemyRecord[] = (enemyRows ?? []).map((row) => ({
    slug: row.slug as string,
    name: row.name as string,
    data: parseEnemyData(row.data),
  }));

  return (
    <CombatBoard
      campaignId={campaignId}
      initialCombatState={combatState}
      characters={characters}
      enemies={enemies}
      isDm={access.isDm}
      userId={access.user?.id ?? null}
    />
  );
}
