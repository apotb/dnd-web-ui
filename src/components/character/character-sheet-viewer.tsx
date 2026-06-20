"use client";

import { useEffect, useRef, useState } from "react";
import { CharacterDeleteButton } from "@/components/character/character-delete-button";
import { CharacterSheet } from "@/components/character/character-sheet";
import { JsonImportExport } from "@/components/character/json-import-export";
import { saveCharacterData } from "@/lib/character/save-character-data";
import { syncCharacterTopLevelFields } from "@/lib/character/utils";
import type { ParsedCharacter } from "@/lib/character/utils";
import type { CharacterData } from "@/lib/schemas/character";
import type { PhbClass } from "@/lib/dnd/phb/types";

interface CharacterSheetViewerProps {
  character: ParsedCharacter;
  campaignId: string;
  classes: PhbClass[];
  isDm: boolean;
  canEdit: boolean;
  canDelete?: boolean;
}

export function CharacterSheetViewer({
  character,
  campaignId,
  classes,
  isDm,
  canEdit,
  canDelete = false,
}: CharacterSheetViewerProps) {
  const [data, setData] = useState<CharacterData>(character.data);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setData(character.data);
  }, [character.id, character.data]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function scheduleSave(next: CharacterData) {
    if (!canEdit) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      setSaveError(null);
      const { error } = await saveCharacterData(character.id, next, classes, {
        isDm,
        originalData: character.data,
      });
      if (error) setSaveError(error);
      setSaving(false);
    }, 400);
  }

  function handleChange(next: CharacterData) {
    setData(next);
    scheduleSave(next);
  }

  async function handleImport(payload: {
    name: string;
    playerName: string;
    data: CharacterData;
  }) {
    const next = syncCharacterTopLevelFields(
      payload.name,
      payload.playerName,
      payload.data
    );
    setData(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);

    setSaving(true);
    setSaveError(null);
    const { error } = await saveCharacterData(character.id, next, classes, {
      isDm,
      originalData: character.data,
    });
    if (error) setSaveError(error);
    setSaving(false);
  }

  async function persistPortrait(path: string) {
    const next = {
      ...data,
      basicInfo: { ...data.basicInfo, portrait: path },
    };
    const { error } = await saveCharacterData(character.id, next, classes, {
      isDm,
      originalData: character.data,
    });
    return { error: error ?? null };
  }

  const headerActions = canEdit ? (
    <>
      <JsonImportExport
        name={character.name}
        playerName={character.player_name}
        data={data}
        onImport={handleImport}
      />
      {canDelete ? (
        <CharacterDeleteButton
          characterId={character.id}
          campaignId={campaignId}
          characterName={character.name}
        />
      ) : null}
    </>
  ) : undefined;

  return (
    <>
      {canEdit && (saving || saveError) ? (
        <p
          className={`text-xs mb-2 ${saveError ? "text-destructive" : "text-muted-foreground"}`}
        >
          {saveError ?? "Saving…"}
        </p>
      ) : null}
      <CharacterSheet
        data={data}
        isDm={isDm}
        editable={canEdit}
        canToggleEquipment={canEdit}
        onChange={canEdit ? handleChange : undefined}
        headerActions={headerActions}
        classes={classes}
        campaignId={campaignId}
        characterId={character.id}
        canEditPortrait={canEdit}
        onPersistPortrait={canEdit ? persistPortrait : undefined}
      />
    </>
  );
}
