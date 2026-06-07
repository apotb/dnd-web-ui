"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  characterExportSchema,
  safeParseCharacterData,
} from "@/lib/schemas/character";

interface CharacterImportButtonProps {
  campaignId: string;
}

export function CharacterImportButton({ campaignId }: CharacterImportButtonProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;

      let name = "Imported Character";
      let playerName = "";
      let data;

      const exportResult = characterExportSchema.safeParse(parsed);
      if (exportResult.success) {
        name = exportResult.data.name;
        playerName = exportResult.data.playerName;
        data = exportResult.data.data;
      } else {
        const dataResult = safeParseCharacterData(parsed);
        if (!dataResult.success) {
          setError("Invalid character JSON");
          setLoading(false);
          return;
        }
        data = dataResult.data;
        name = data.basicInfo.name || name;
        playerName = data.basicInfo.playerName;
      }

      const supabase = createClient();
      const { data: row, error: insertError } = await supabase
        .from("characters")
        .insert({
          campaign_id: campaignId,
          name,
          player_name: playerName,
          data,
        })
        .select("id")
        .single();

      if (insertError || !row) {
        setError("Import failed");
        setLoading(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Could not read file");
    }

    setLoading(false);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      {error ? (
        <button
          type="button"
          className="retro-inline-link retro-inline-error-link"
          onClick={() => setError(null)}
        >
          {error}
        </button>
      ) : (
        <button
          type="button"
          className="retro-inline-link"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
        >
          {loading ? "Importing…" : "Import .json"}
        </button>
      )}
    </>
  );
}
