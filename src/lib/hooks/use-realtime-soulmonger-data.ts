"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCampaignRealtimeColumn } from "@/lib/hooks/campaign-realtime-payload";
import {
  parseSoulmongerData,
  type SoulmongerData,
} from "@/lib/schemas/soulmonger";
import type { Campaign } from "@/lib/types/database";

export function useRealtimeSoulmongerData(
  campaignId: string,
  initialSoulmongerData: SoulmongerData
) {
  const [soulmongerData, setSoulmongerData] = useState(initialSoulmongerData);

  useEffect(() => {
    setSoulmongerData(initialSoulmongerData);
  }, [initialSoulmongerData]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`campaign-soulmonger:${campaignId}`)
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
          const soulmongerData = getCampaignRealtimeColumn(row, "soulmonger_data");
          if (soulmongerData === undefined) return;
          setSoulmongerData(parseSoulmongerData(soulmongerData));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  return soulmongerData;
}
