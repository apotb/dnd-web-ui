"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createDefaultCharacterData } from "@/lib/schemas/character";

export function NewCharacterForm({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    const data = createDefaultCharacterData({
      basicInfo: { name, playerName },
    });

    const supabase = createClient();
    const { data: row, error } = await supabase
      .from("characters")
      .insert({
        campaign_id: campaignId,
        name: name || "New Character",
        player_name: playerName,
        data,
      })
      .select("id")
      .single();

    if (!error && row) {
      router.push(`/campaigns/${campaignId}/characters/${row.id}`);
    }
    setLoading(false);
  }

  return (
    <div className="retro-box retro-box-narrow">
      <label className="candy-label" htmlFor="character-name">
        Character name
      </label>
      <input
        id="character-name"
        className="candy-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <label className="candy-label" htmlFor="player-name">
        Player name
      </label>
      <input
        id="player-name"
        className="candy-input"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
      />
      <button
        type="button"
        className="candy-btn"
        onClick={create}
        disabled={loading}
      >
        {loading ? "..." : "Create character"}
      </button>
    </div>
  );
}
