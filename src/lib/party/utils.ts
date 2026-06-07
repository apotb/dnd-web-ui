import { parsePartyData, type PartyData } from "@/lib/schemas/party";
import type { Campaign } from "@/lib/types/database";

export type ParsedCampaign = Campaign & { partyData: PartyData };

export function parseCampaignRow(row: Campaign): ParsedCampaign {
  return {
    ...row,
    partyData: parsePartyData(row.party_data),
  };
}
