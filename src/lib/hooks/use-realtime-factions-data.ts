"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCampaignRealtimeColumn } from "@/lib/hooks/campaign-realtime-payload";
import { parseFactionsData, type FactionsData } from "@/lib/schemas/factions";
import type { Campaign } from "@/lib/types/database";

export function useRealtimeFactionsData(
  campaignId: string,
  initialFactionsData: FactionsData
) {
  const [factionsData, setFactionsData] = useState(initialFactionsData);

  useEffect(() => {
    setFactionsData(initialFactionsData);
  }, [initialFactionsData]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`campaign-factions:${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "campaigns",
          filter: `id=eq.${campaignId}`,
        },
        (payload) => {
          const row = payload.new as Partial<Campaign>;
          const factionsData = getCampaignRealtimeColumn(row, "factions_data");
          if (factionsData === undefined) return;
          setFactionsData(parseFactionsData(factionsData));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  return factionsData;
}
