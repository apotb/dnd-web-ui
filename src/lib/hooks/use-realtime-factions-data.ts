"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
          const row = payload.new as Campaign;
          setFactionsData(parseFactionsData(row.factions_data ?? {}));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  return factionsData;
}
