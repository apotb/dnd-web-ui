"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Encounter } from "@/lib/types/database";

interface EncounterListProps {
  campaignId: string;
  encounters: Encounter[];
  isDm: boolean;
}

export function EncounterList({
  campaignId,
  encounters,
  isDm,
}: EncounterListProps) {
  const router = useRouter();
  const [name, setName] = useState("New Encounter");
  const [creating, setCreating] = useState(false);

  async function createEncounter() {
    setCreating(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("encounters")
      .insert({
        campaign_id: campaignId,
        name,
        round: 0,
        current_turn_index: 0,
        active: false,
      })
      .select("id")
      .single();

    if (!error && data) {
      router.push(`/campaigns/${campaignId}/combat/${data.id}`);
    }
    setCreating(false);
  }

  return (
    <div>
      <h2 className="page-title">Combat</h2>

      {isDm && (
        <div className="retro-box">
          <p className="retro-box-title">New encounter</p>
          <label className="candy-label" htmlFor="encounter-name">
            Name
          </label>
          <input
            id="encounter-name"
            className="candy-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            className="candy-btn"
            onClick={createEncounter}
            disabled={creating}
          >
            {creating ? "..." : "Create encounter"}
          </button>
        </div>
      )}

      {encounters.length === 0 ? (
        <p className="retro-note">No encounters yet.</p>
      ) : (
        <div className="nav-row-stack">
          {encounters.map((enc) => (
            <Link
              key={enc.id}
              href={`/campaigns/${campaignId}/combat/${enc.id}`}
              className="candy-btn"
            >
              {enc.name}
              {enc.active ? ` · Round ${enc.round}` : ""}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
