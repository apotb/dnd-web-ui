import { createClient } from "@/lib/supabase/server";
import { getCampaignAccess } from "@/lib/auth/campaign-access";
import { parseCharacterRow } from "@/lib/character/utils";
import { parsePartyData } from "@/lib/schemas/party";
import { parseWorldData } from "@/lib/schemas/world";
import { parseMapsData } from "@/lib/schemas/maps";
import { parseCalendarEventRow } from "@/lib/schemas/calendar-event";
import { CampaignOverview } from "@/components/campaign/campaign-overview";
import type { CampaignCalendarEvent, Character } from "@/lib/types/database";

export default async function CampaignHomePage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const access = await getCampaignAccess(campaignId);
  if (!access) return null;

  const supabase = await createClient();
  const [{ data: rows }, { data: eventRows }] = await Promise.all([
    supabase
      .from("characters")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("name"),
    supabase
      .from("campaign_calendar_events")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("month")
      .order("day"),
  ]);

  const characters = (rows ?? []).map((row) =>
    parseCharacterRow(row as Character, access.isDm)
  );
  const calendarEvents = (eventRows ?? []).map((row) =>
    parseCalendarEventRow(row as CampaignCalendarEvent)
  );
  const canManageCalendarEvents =
    !!access.user && (access.isDm || access.ownedCharacter !== null);

  return (
    <CampaignOverview
      campaignId={campaignId}
      initialPartyData={parsePartyData(access.campaign.party_data)}
      initialWorldData={parseWorldData(access.campaign.world_data)}
      initialMapsData={parseMapsData(access.campaign.maps_data)}
      initialCalendarEvents={calendarEvents}
      initialCharacters={characters}
      isDm={access.isDm}
      userId={access.user?.id ?? null}
      canManageCalendarEvents={canManageCalendarEvents}
    />
  );
}
