"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CharacterSheet } from "@/components/character/character-sheet";
import { JsonImportExport } from "@/components/character/json-import-export";
import type { CharacterData } from "@/lib/schemas/character";
import { syncCharacterTopLevelFields } from "@/lib/character/utils";

interface CharacterEditorProps {
  characterId: string;
  campaignId: string;
  initialName: string;
  initialPlayerName: string;
  initialData: CharacterData;
}

export function CharacterEditor({
  characterId,
  campaignId,
  initialName,
  initialPlayerName,
  initialData,
}: CharacterEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [playerName, setPlayerName] = useState(initialPlayerName);
  const [data, setData] = useState(initialData);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);

    const synced = syncCharacterTopLevelFields(name, playerName, data);
    const supabase = createClient();

    const { error } = await supabase
      .from("characters")
      .update({
        name: name || synced.basicInfo.name,
        player_name: playerName || synced.basicInfo.playerName,
        data: synced,
      })
      .eq("id", characterId);

    if (error) {
      setMessage(error.message);
    } else {
      setData(synced);
      setMessage("Saved");
      router.refresh();
    }

    setSaving(false);
  }

  async function deleteCharacter() {
    if (!confirm("Delete this character?")) return;
    const supabase = createClient();
    await supabase.from("characters").delete().eq("id", characterId);
    router.push(`/campaigns/${campaignId}/characters`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="char-name">Character Name</Label>
            <Input
              id="char-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="player-name">Player Name</Label>
            <Input
              id="player-name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <JsonImportExport
            name={name}
            playerName={playerName}
            data={data}
            onImport={({ name: n, playerName: pn, data: d }) => {
              setName(n);
              setPlayerName(pn);
              setData(d);
            }}
          />
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button variant="destructive" onClick={deleteCharacter}>
            Delete
          </Button>
        </div>
      </div>
      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
      <CharacterSheet
        data={data}
        isDm
        editable
        onChange={setData}
      />
    </div>
  );
}
