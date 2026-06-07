"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>New Character</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Character Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="player">Player Name</Label>
          <Input
            id="player"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
        </div>
        <Button onClick={create} disabled={loading}>
          {loading ? "Creating..." : "Create Character"}
        </Button>
      </CardContent>
    </Card>
  );
}
