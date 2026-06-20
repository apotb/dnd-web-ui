"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
          const row = payload.new as Campaign;
          setNotablesData(parseNotablesData(row.notables_data ?? {}));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  return notablesData;
}
