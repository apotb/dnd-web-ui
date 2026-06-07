"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parsePartyData, type PartyData } from "@/lib/schemas/party";
import type { Campaign } from "@/lib/types/database";

export function useRealtimePartyData(
  campaignId: string,
  initialPartyData: PartyData
) {
  const [partyData, setPartyData] = useState(initialPartyData);

  useEffect(() => {
    setPartyData(initialPartyData);
  }, [initialPartyData]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`campaign-party:${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "campaigns",
          filter: `id=eq.${campaignId}`,
        },
        (payload) => {
          const row = payload.new as Campaign;
          setPartyData(parsePartyData(row.party_data));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  return partyData;
}
