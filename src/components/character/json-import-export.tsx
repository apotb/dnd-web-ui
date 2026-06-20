"use client";

import { useRef, useState } from "react";
import { characterExportSchema, type CharacterData } from "@/lib/schemas/character";
import { parseCharacterImportFile } from "@/lib/character/parse-import";

interface JsonImportExportProps {
  name: string;
  playerName: string;
  data: CharacterData;
  onImport: (payload: {
    name: string;
    playerName: string;
    data: CharacterData;
  }) => void;
}

export function JsonImportExport({
  name,
  playerName,
  data,
  onImport,
}: JsonImportExportProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  function handleExport() {
    const payload = characterExportSchema.parse({
      version: 1,
      name,
      playerName,
      data,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name || "character"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    setImporting(true);
    setImportError(null);

    try {
      const result = await parseCharacterImportFile(file, { name, playerName });
      onImport(result);
    } catch {
      setImportError("Invalid character JSON");
    }

    setImporting(false);
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
      <button
        type="button"
        className="retro-inline-link text-sm"
        onClick={handleExport}
      >
        export
      </button>
      {importError ? (
        <button
          type="button"
          className="retro-inline-link retro-inline-error-link text-sm"
          onClick={() => setImportError(null)}
        >
          {importError}
        </button>
      ) : (
        <button
          type="button"
          className="retro-inline-link text-sm"
          disabled={importing}
          onClick={() => inputRef.current?.click()}
        >
          {importing ? "importing…" : "import"}
        </button>
      )}
    </>
  );
}
