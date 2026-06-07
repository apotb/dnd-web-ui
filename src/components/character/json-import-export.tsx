"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  characterExportSchema,
  safeParseCharacterData,
  type CharacterData,
} from "@/lib/schemas/character";

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
  const [open, setOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  function handleImport() {
    setError(null);
    try {
      const parsed = JSON.parse(jsonText) as unknown;

      // Support both export envelope and raw character data
      const exportResult = characterExportSchema.safeParse(parsed);
      if (exportResult.success) {
        onImport({
          name: exportResult.data.name,
          playerName: exportResult.data.playerName,
          data: exportResult.data.data,
        });
        setOpen(false);
        return;
      }

      const dataResult = safeParseCharacterData(parsed);
      if (dataResult.success) {
        onImport({
          name: dataResult.data.basicInfo.name || name,
          playerName: dataResult.data.basicInfo.playerName || playerName,
          data: dataResult.data,
        });
        setOpen(false);
        return;
      }

      setError("Invalid character JSON. Check the format and try again.");
    } catch {
      setError("Could not parse JSON.");
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={handleExport}>
        Export JSON
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Import JSON
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Character JSON</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={12}
            placeholder='Paste character export JSON or raw "data" object...'
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button onClick={handleImport}>Import</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
