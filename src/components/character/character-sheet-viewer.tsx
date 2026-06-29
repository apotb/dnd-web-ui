"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CharacterDeleteButton } from "@/components/character/character-delete-button";
import { CharacterSheet } from "@/components/character/character-sheet";
import { JsonImportExport } from "@/components/character/json-import-export";
import { ShortRestHealModal } from "@/components/character/short-rest-heal-modal";
import { saveCharacterData } from "@/lib/character/save-character-data";
import { syncCharacterTopLevelFields } from "@/lib/character/utils";
import type { ParsedCharacter } from "@/lib/character/utils";
import { useRealtimeWorldData } from "@/lib/hooks/use-realtime-world-data";
import { getCampaignCalendarDate, type WorldData } from "@/lib/schemas/world";
import type { CharacterData } from "@/lib/schemas/character";
import type { PhbClass } from "@/lib/dnd/phb/types";

interface CharacterSheetViewerProps {
  character: ParsedCharacter;
  campaignId: string;
  classes: PhbClass[];
  isDm: boolean;
  canEdit: boolean;
  canDelete?: boolean;
  initialWorldData: WorldData;
  ownedCharacterId?: string | null;
}

export function CharacterSheetViewer({
  character,
  campaignId,
  classes,
  isDm,
  canEdit,
  canDelete = false,
  initialWorldData,
  ownedCharacterId = null,
}: CharacterSheetViewerProps) {
  const worldData = useRealtimeWorldData(campaignId, initialWorldData);
  const campaignDate = getCampaignCalendarDate(worldData);
  const [data, setData] = useState<CharacterData>(character.data);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setData(character.data);
  }, [character.id, character.data]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  async function persistNow(next: CharacterData) {
    if (!canEdit) return;
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
    if (next.combat.pendingShortRest !== data.combat.pendingShortRest) {
      void persistNow(next);
      return;
    }
    scheduleSave(next);
  }

  async function handleShortRestApply(next: CharacterData) {
    setData(next);
    await persistNow(next);
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

  const showShortRestHealModal =
    canEdit &&
    data.combat.pendingShortRest &&
    character.id !== ownedCharacterId;

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
        campaignDate={campaignDate}
        canRest={canEdit}
      />
      {mounted && showShortRestHealModal
        ? createPortal(
            <ShortRestHealModal
              data={data}
              classes={classes}
              onApply={handleShortRestApply}
            />,
            document.body
          )
        : null}
    </>
  );
}
