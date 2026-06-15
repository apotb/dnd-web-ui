"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseWorldData, type WorldData } from "@/lib/schemas/world";
import type { Campaign } from "@/lib/types/database";

export function useRealtimeWorldData(
  campaignId: string,
  initialWorldData: WorldData
) {
  const [worldData, setWorldData] = useState(initialWorldData);

  useEffect(() => {
    setWorldData(initialWorldData);
  }, [initialWorldData]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`campaign-world:${campaignId}`)
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
          setWorldData(parseWorldData(row.world_data));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  return worldData;
}
