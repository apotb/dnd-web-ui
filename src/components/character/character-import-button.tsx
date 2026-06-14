"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseCharacterImportFile } from "@/lib/character/parse-import";

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
      const { name, playerName, data } = await parseCharacterImportFile(file);

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
          className="candy-btn"
          style={{ color: "red", flex: "0 1 auto" }}
          onClick={() => setError(null)}
        >
          {error}
        </button>
      ) : (
        <button
          type="button"
          className="candy-btn"
          style={{ flex: "0 1 auto" }}
          disabled={loading}
          onClick={() => inputRef.current?.click()}
        >
          {loading ? "Importing…" : "Import .json"}
        </button>
      )}
    </>
  );
}
