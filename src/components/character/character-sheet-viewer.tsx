"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CharacterDeleteButton } from "@/components/character/character-delete-button";
import { CharacterSheet } from "@/components/character/character-sheet";
import { CreationChoiceEditProvider } from "@/components/character/creation-choice-edit-context";
import { CreationChoiceUnsavedGuard } from "@/components/character/creation-choice-unsaved-guard";
import { JsonImportExport } from "@/components/character/json-import-export";
import { ShortRestHealModal } from "@/components/character/short-rest-heal-modal";
import { HpPoolModal } from "@/components/character/hp-pool-modal";
import { saveCharacterData } from "@/lib/character/save-character-data";
import { syncCharacterTopLevelFields } from "@/lib/character/utils";
import type { ParsedCharacter } from "@/lib/character/utils";
import { useRealtimeWorldData } from "@/lib/hooks/use-realtime-world-data";
import { useRealtimeCharacters } from "@/lib/hooks/use-realtime-characters";
import { getCampaignCalendarDate, type WorldData } from "@/lib/schemas/world";
import type { CharacterData } from "@/lib/schemas/character";
import type { PhbBackground, PhbClass, PhbSpecies } from "@/lib/dnd/phb/types";

/** Wait for rapid edits (e.g. equip toggles) to settle before persisting. */
const SAVE_DEBOUNCE_MS = 900;

interface CharacterSheetViewerProps {
  character: ParsedCharacter;
  campaignId: string;
  classes: PhbClass[];
  isDm: boolean;
  canEdit: boolean;
  canDelete?: boolean;
  initialWorldData: WorldData;
  ownedCharacterId?: string | null;
  initialPartyCharacters?: ParsedCharacter[];
  /** Live party list from a parent that already subscribes to character updates. */
  partyCharacters?: ParsedCharacter[];
  hpPoolCombatPreferred?: boolean;
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
  initialPartyCharacters = [],
  partyCharacters: partyCharactersFromParent,
  hpPoolCombatPreferred = false,
}: CharacterSheetViewerProps) {
  const worldData = useRealtimeWorldData(campaignId, initialWorldData);
  const subscribedPartyCharacters = useRealtimeCharacters(
    campaignId,
    initialPartyCharacters,
    isDm,
    { enabled: partyCharactersFromParent == null }
  );
  const partyCharacters = partyCharactersFromParent ?? subscribedPartyCharacters;
  const featureCatalogs = useMemo(
    () => ({
      classes,
      species: [] as PhbSpecies[],
      backgrounds: [] as PhbBackground[],
    }),
    [classes]
  );
  const campaignDate = getCampaignCalendarDate(worldData);
  const [data, setData] = useState<CharacterData>(character.data);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [hpPoolFeatureId, setHpPoolFeatureId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(data);
  const saveInFlightRef = useRef(false);
  const localRevisionRef = useRef(0);
  const lastSyncedRevisionRef = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    setData(character.data);
    dataRef.current = character.data;
    localRevisionRef.current = 0;
    lastSyncedRevisionRef.current = 0;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
  }, [character.id]);

  useEffect(() => {
    if (localRevisionRef.current !== lastSyncedRevisionRef.current) return;
    if (saveTimer.current) return;
    if (saveInFlightRef.current) return;
    setData(character.data);
    dataRef.current = character.data;
  }, [character.data]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  function markLocalEdit(next: CharacterData) {
    localRevisionRef.current += 1;
    dataRef.current = next;
    setData(next);
  }

  function noteSuccessfulSave(revisionAtSave: number) {
    if (localRevisionRef.current === revisionAtSave) {
      lastSyncedRevisionRef.current = revisionAtSave;
    }
  }

  async function flushSave() {
    if (!canEdit || saveInFlightRef.current) return;

    const revisionAtSave = localRevisionRef.current;
    const toSave = dataRef.current;

    saveInFlightRef.current = true;
    setSaving(true);
    setSaveError(null);

    const { error } = await saveCharacterData(character.id, toSave, classes, {
      isDm,
      originalData: character.data,
    });

    saveInFlightRef.current = false;
    if (error) setSaveError(error);
    setSaving(false);
    noteSuccessfulSave(revisionAtSave);

    if (localRevisionRef.current !== revisionAtSave) {
      scheduleSave();
    }
  }

  async function persistNow(next: CharacterData) {
    if (!canEdit) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    markLocalEdit(next);
    const revisionAtSave = localRevisionRef.current;

    saveInFlightRef.current = true;
    setSaving(true);
    setSaveError(null);

    const { error } = await saveCharacterData(character.id, next, classes, {
      isDm,
      originalData: character.data,
    });

    saveInFlightRef.current = false;
    if (error) setSaveError(error);
    setSaving(false);
    noteSuccessfulSave(revisionAtSave);

    if (localRevisionRef.current !== revisionAtSave) {
      scheduleSave();
    }
  }

  function scheduleSave() {
    if (!canEdit) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void flushSave();
    }, SAVE_DEBOUNCE_MS);
  }

  function handleChange(next: CharacterData) {
    const pendingShortRestChanged =
      next.combat.pendingShortRest !== data.combat.pendingShortRest;
    if (pendingShortRestChanged) {
      void persistNow(next);
      return;
    }
    markLocalEdit(next);
    scheduleSave();
  }

  async function handleShortRestApply(next: CharacterData) {
    await persistNow(next);
  }

  async function handleHpPoolApply(result: {
    actorData: CharacterData;
    targetId: string;
    targetData: CharacterData;
  }) {
    await persistNow(result.actorData);
    if (result.targetId !== character.id) {
      const target = partyCharacters.find((entry) => entry.id === result.targetId);
      if (target) {
        const { error } = await saveCharacterData(
          result.targetId,
          result.targetData,
          classes,
          { isDm, originalData: target.data }
        );
        if (error) setSaveError(error);
      }
    }
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
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    markLocalEdit(next);
    const revisionAtSave = localRevisionRef.current;

    saveInFlightRef.current = true;
    setSaving(true);
    setSaveError(null);
    const { error } = await saveCharacterData(character.id, next, classes, {
      isDm,
      originalData: character.data,
    });
    saveInFlightRef.current = false;
    if (error) setSaveError(error);
    setSaving(false);
    noteSuccessfulSave(revisionAtSave);
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
      {mounted && canEdit && (saving || saveError)
        ? createPortal(
            <div
              className={`sheet-save-status${saveError ? " sheet-save-status--error" : ""}`}
              role="status"
              aria-live="polite"
            >
              {saveError ?? "Saving…"}
            </div>,
            document.body
          )
        : null}
      <CreationChoiceEditProvider>
        {canEdit ? <CreationChoiceUnsavedGuard /> : null}
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
          hpPoolCombatPreferred={hpPoolCombatPreferred}
          onUseHpPool={canEdit ? (featureId) => setHpPoolFeatureId(featureId) : undefined}
        />
      </CreationChoiceEditProvider>
      {mounted && hpPoolFeatureId
        ? createPortal(
            <HpPoolModal
              featureId={hpPoolFeatureId}
              actor={{ ...character, data }}
              partyCharacters={partyCharacters}
              featureCatalogs={featureCatalogs}
              onApply={handleHpPoolApply}
              onClose={() => setHpPoolFeatureId(null)}
            />,
            document.body
          )
        : null}
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
