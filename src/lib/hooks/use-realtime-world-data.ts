"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseWorldData, type WorldData } from "@/lib/schemas/world";
import type { Campaign } from "@/lib/types/database";
import type { RealtimeChannel } from "@supabase/supabase-js";

type WorldDataListener = (data: WorldData) => void;

interface WorldDataSubscription {
  worldData: WorldData;
  listeners: Set<WorldDataListener>;
  channel: RealtimeChannel;
}

const subscriptions = new Map<string, WorldDataSubscription>();

function subscribeToCampaignWorld(
  campaignId: string,
  initialWorldData: WorldData
): WorldDataSubscription {
  const existing = subscriptions.get(campaignId);
  if (existing) return existing;

  const supabase = createClient();
  const entry: WorldDataSubscription = {
    worldData: initialWorldData,
    listeners: new Set(),
    channel: supabase.channel(`campaign-world:${campaignId}`),
  };

  entry.channel
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
        entry.worldData = parseWorldData(row.world_data);
        for (const listener of entry.listeners) {
          listener(entry.worldData);
        }
      }
    )
    .subscribe();

  subscriptions.set(campaignId, entry);
  return entry;
}

function unsubscribeFromCampaignWorld(
  campaignId: string,
  listener: WorldDataListener
) {
  const entry = subscriptions.get(campaignId);
  if (!entry) return;

  entry.listeners.delete(listener);
  if (entry.listeners.size > 0) return;

  const supabase = createClient();
  supabase.removeChannel(entry.channel);
  subscriptions.delete(campaignId);
}

export function useRealtimeWorldData(
  campaignId: string,
  initialWorldData: WorldData
) {
  const [worldData, setWorldData] = useState(initialWorldData);

  useEffect(() => {
    setWorldData(initialWorldData);
  }, [initialWorldData]);

  useEffect(() => {
    const entry = subscribeToCampaignWorld(campaignId, initialWorldData);

    const listener: WorldDataListener = (data) => setWorldData(data);
    entry.listeners.add(listener);
    setWorldData(entry.worldData);

    return () => unsubscribeFromCampaignWorld(campaignId, listener);
  }, [campaignId]);

  return worldData;
}
