"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
          const row = payload.new as Campaign;
          setSoulmongerData(parseSoulmongerData(row.soulmonger_data));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  return soulmongerData;
}
