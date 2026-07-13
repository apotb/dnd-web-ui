"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCampaignRealtimeColumn } from "@/lib/hooks/campaign-realtime-payload";
import { parseNotablesData, type NotablesData } from "@/lib/schemas/notables";
import type { Campaign } from "@/lib/types/database";

export function useRealtimeNotablesData(
  campaignId: string,
  initialNotablesData: NotablesData
) {
  const [notablesData, setNotablesData] = useState(initialNotablesData);

  useEffect(() => {
    setNotablesData(initialNotablesData);
  }, [initialNotablesData]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`campaign-notables:${campaignId}`)
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
          const notablesData = getCampaignRealtimeColumn(row, "notables_data");
          if (notablesData === undefined) return;
          setNotablesData(parseNotablesData(notablesData));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  return notablesData;
}
