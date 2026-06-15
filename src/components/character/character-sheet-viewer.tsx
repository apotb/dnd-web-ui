"use client";

import { useEffect, useRef, useState } from "react";
import { CharacterSheet } from "@/components/character/character-sheet";
import { saveCharacterData } from "@/lib/character/save-character-data";
import type { ParsedCharacter } from "@/lib/character/utils";
import type { CharacterData } from "@/lib/schemas/character";
import type { PhbClass } from "@/lib/dnd/phb/types";

interface CharacterSheetViewerProps {
  character: ParsedCharacter;
  campaignId: string;
  classes: PhbClass[];
  isDm: boolean;
  canToggleEquipment: boolean;
  canEditPortrait: boolean;
  editHref?: string;
}

export function CharacterSheetViewer({
  character,
  campaignId,
  classes,
  isDm,
  canToggleEquipment,
  canEditPortrait,
  editHref,
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
    if (!canToggleEquipment) return;
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

  return (
    <>
      {canToggleEquipment && (saving || saveError) ? (
        <p
          className={`text-xs mb-2 ${saveError ? "text-destructive" : "text-muted-foreground"}`}
        >
          {saveError ?? "Saving…"}
        </p>
      ) : null}
      <CharacterSheet
        data={data}
        isDm={isDm}
        editable={false}
        canToggleEquipment={canToggleEquipment}
        onChange={
          canToggleEquipment
            ? handleChange
            : canEditPortrait
              ? setData
              : undefined
        }
        classes={classes}
        editHref={editHref}
        campaignId={campaignId}
        characterId={character.id}
        canEditPortrait={canEditPortrait}
        onPersistPortrait={canEditPortrait ? persistPortrait : undefined}
      />
    </>
  );
}
