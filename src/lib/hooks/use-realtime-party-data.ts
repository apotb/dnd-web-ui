"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  mergePartyData,
  parsePartyData,
  type PartyData,
} from "@/lib/schemas/party";
import type { Campaign } from "@/lib/types/database";
import type { RealtimeChannel } from "@supabase/supabase-js";

type PartyDataListener = (data: PartyData) => void;

interface PartyDataSubscription {
  partyData: PartyData;
  listeners: Set<PartyDataListener>;
  channel: RealtimeChannel;
}

const subscriptions = new Map<string, PartyDataSubscription>();

function partyDataRevision(data: PartyData): string {
  return [
    data.allies
      .map(
        (ally) =>
          `${ally.id}:${ally.currentHp}:${ally.name}:${(ally.conditions ?? []).join(".")}`
      )
      .join(","),
    data.animals.map((animal) => animal.id).join(","),
    data.items.map((item) => `${item.id}:${item.quantity}`).join(","),
    data.notes,
  ].join("|");
}

function notifyPartyDataListeners(entry: PartyDataSubscription, data: PartyData) {
  entry.partyData = data;
  for (const listener of entry.listeners) {
    listener(data);
  }
}

function publishPartyData(campaignId: string, incoming: PartyData): PartyData {
  const entry = subscriptions.get(campaignId);
  if (!entry) return incoming;

  const merged = mergePartyData(entry.partyData, incoming);
  if (partyDataRevision(merged) === partyDataRevision(entry.partyData)) {
    return entry.partyData;
  }

  notifyPartyDataListeners(entry, merged);
  return merged;
}

export async function fetchCampaignPartyData(
  campaignId: string
): Promise<PartyData | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("party_data")
    .eq("id", campaignId)
    .single();

  if (error || !data) return null;
  return parsePartyData(data.party_data);
}

/** Fetch latest party_data from the DB and push it through the shared subscription. */
export async function refreshCampaignPartyData(campaignId: string): Promise<PartyData> {
  const fresh = await fetchCampaignPartyData(campaignId);
  if (!fresh) {
    return subscriptions.get(campaignId)?.partyData ?? parsePartyData({});
  }
  return publishPartyData(campaignId, fresh);
}

function subscribeToCampaignParty(
  campaignId: string,
  initialPartyData: PartyData
): PartyDataSubscription {
  const existing = subscriptions.get(campaignId);
  if (existing) return existing;

  const supabase = createClient();
  const entry: PartyDataSubscription = {
    partyData: initialPartyData,
    listeners: new Set(),
    channel: supabase.channel(`campaign-party:${campaignId}`),
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
        publishPartyData(campaignId, parsePartyData(row.party_data));
      }
    )
    .subscribe();

  subscriptions.set(campaignId, entry);
  return entry;
}

function unsubscribeFromCampaignParty(
  campaignId: string,
  listener: PartyDataListener
) {
  const entry = subscriptions.get(campaignId);
  if (!entry) return;

  entry.listeners.delete(listener);
  if (entry.listeners.size > 0) return;

  const supabase = createClient();
  supabase.removeChannel(entry.channel);
  subscriptions.delete(campaignId);
}

export function useRealtimePartyData(
  campaignId: string,
  initialPartyData: PartyData
) {
  const [partyData, setPartyData] = useState(initialPartyData);

  useEffect(() => {
    publishPartyData(campaignId, initialPartyData);
  }, [campaignId, initialPartyData]);

  useEffect(() => {
    const entry = subscribeToCampaignParty(campaignId, initialPartyData);

    const listener: PartyDataListener = (data) => setPartyData(data);
    entry.listeners.add(listener);
    setPartyData(entry.partyData);

    let cancelled = false;
    void fetchCampaignPartyData(campaignId).then((fresh) => {
      if (cancelled || !fresh) return;
      publishPartyData(campaignId, fresh);
    });

    return () => {
      cancelled = true;
      unsubscribeFromCampaignParty(campaignId, listener);
    };
    // initialPartyData is merged via the effect above; only subscribe once per campaign.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see useRealtimeWorldData
  }, [campaignId]);

  return partyData;
}
