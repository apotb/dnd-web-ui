"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getCampaignRealtimeColumn } from "@/lib/hooks/campaign-realtime-payload";
import { parseMapsData, type MapsData } from "@/lib/schemas/maps";
import type { Campaign } from "@/lib/types/database";

export function useRealtimeMapsData(
  campaignId: string,
  initialMapsData: MapsData
) {
  const [mapsData, setMapsData] = useState(initialMapsData);

  useEffect(() => {
    setMapsData(initialMapsData);
  }, [initialMapsData]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`campaign-maps:${campaignId}`)
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
          const mapsData = getCampaignRealtimeColumn(row, "maps_data");
          if (mapsData === undefined) return;
          setMapsData(parseMapsData(mapsData));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  return mapsData;
}
