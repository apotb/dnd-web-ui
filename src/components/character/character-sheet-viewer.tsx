"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CharacterDeleteButton } from "@/components/character/character-delete-button";
import { CharacterSheet } from "@/components/character/character-sheet";
import { CreationChoiceEditProvider } from "@/components/character/creation-choice-edit-context";
import { CreationChoiceUnsavedGuard } from "@/components/character/creation-choice-unsaved-guard";
import { JsonImportExport } from "@/components/character/json-import-export";
import { ShortRestHealModal } from "@/components/character/short-rest-heal-modal";
import { HpPoolModal } from "@/components/character/hp-pool-modal";
import { AlertModal } from "@/components/ui/alert-modal";
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

const NAV_WAIT_MESSAGE =
  "You haven't saved yet. Please wait a moment for autosave.";

export interface CharacterSheetViewerHandle {
  beforeNavigate: (action: () => void) => void;
}

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

export const CharacterSheetViewer = forwardRef<
  CharacterSheetViewerHandle,
  CharacterSheetViewerProps
>(function CharacterSheetViewer(
  {
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
  },
  ref
) {
  const router = useRouter();
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
  const [navWaitOpen, setNavWaitOpen] = useState(false);
  const [navSaveComplete, setNavSaveComplete] = useState(false);
  const [navWaitError, setNavWaitError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(data);
  const saveInFlightRef = useRef(false);
  const localRevisionRef = useRef(0);
  const lastSyncedRevisionRef = useRef(0);
  const pendingNavActionRef = useRef<(() => void) | null>(null);
  const pendingNavigationHrefRef = useRef<string | null>(null);
  const flushSaveNowRef = useRef<() => Promise<void>>(async () => {});

  function isPendingSaveNow() {
    return (
      localRevisionRef.current !== lastSyncedRevisionRef.current ||
      saveTimer.current !== null ||
      saveInFlightRef.current
    );
  }

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
    setNavWaitOpen(false);
    pendingNavActionRef.current = null;
    pendingNavigationHrefRef.current = null;
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

  async function flushSave(): Promise<string | null> {
    if (!canEdit || saveInFlightRef.current) return null;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

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

    return error ?? null;
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

  const flushSaveNow = useCallback(async () => {
    if (!canEdit) return;

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    for (;;) {
      if (
        localRevisionRef.current === lastSyncedRevisionRef.current &&
        !saveInFlightRef.current
      ) {
        return;
      }

      if (saveInFlightRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        continue;
      }

      const error = await flushSave();
      if (error) throw new Error(error);
    }
  }, [canEdit, character.data, character.id, classes, isDm]);

  flushSaveNowRef.current = flushSaveNow;

  const startNavWait = useCallback(
    (action: (() => void) | null, href: string | null) => {
      pendingNavActionRef.current = action;
      pendingNavigationHrefRef.current = href;
      setNavSaveComplete(false);
      setNavWaitError(null);
      setNavWaitOpen(true);

      void flushSaveNow()
        .then(() => setNavSaveComplete(true))
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : "Save failed.";
          setNavWaitError(message);
          setNavSaveComplete(true);
        });
    },
    [flushSaveNow]
  );
 
  const beforeNavigate = useCallback(
    (action: () => void) => {
      if (!isPendingSaveNow()) {
        action();
        return;
      }
      startNavWait(action, null);
    },
    [startNavWait]
  );

  useImperativeHandle(ref, () => ({ beforeNavigate }), [beforeNavigate]);

  const handleNavWaitClose = useCallback(() => {
    if (!navSaveComplete) return;

    const href = pendingNavigationHrefRef.current;
    const action = pendingNavActionRef.current;
    const hadError = navWaitError !== null;

    pendingNavigationHrefRef.current = null;
    pendingNavActionRef.current = null;
    setNavWaitOpen(false);
    setNavWaitError(null);

    if (hadError) return;

    if (href) {
      router.push(href);
    } else if (action) {
      action();
    }
  }, [navSaveComplete, navWaitError, router]);

  useEffect(() => {
    if (!canEdit) return;

    function handleDocumentClick(event: MouseEvent) {
      if (!isPendingSaveNow()) return;

      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname) return;
      } catch {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      const target = `${url.pathname}${url.search}${url.hash}`;
      startNavWait(null, target);
    }

    document.addEventListener("click", handleDocumentClick, true);
    return () => document.removeEventListener("click", handleDocumentClick, true);
  }, [canEdit, startNavWait]);

  useEffect(() => {
    if (!canEdit) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!isPendingSaveNow()) return;
      event.preventDefault();
      event.returnValue = "";
      void flushSaveNowRef.current();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [canEdit]);

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

  const navWaitMessage = navWaitError ?? NAV_WAIT_MESSAGE;

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
      {mounted && canEdit ? (
        <AlertModal
          open={navWaitOpen}
          title="Saving changes"
          message={navWaitMessage}
          confirmDisabled={!navSaveComplete}
          onClose={handleNavWaitClose}
        />
      ) : null}
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
});
