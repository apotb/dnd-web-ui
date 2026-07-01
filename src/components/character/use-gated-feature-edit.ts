"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useCreationChoiceEditOptional } from "@/components/character/creation-choice-edit-context";
import type { CharacterData } from "@/lib/schemas/character";

interface UseGatedFeatureEditOptions {
  featureId: string;
  editable?: boolean;
  savedData: CharacterData;
  isDraftDirty: (saved: CharacterData, draft: CharacterData) => boolean;
  onCommit: (draft: CharacterData) => void;
}

function cloneCharacterData(data: CharacterData): CharacterData {
  return structuredClone(data);
}

export function useGatedFeatureEdit({
  featureId,
  editable,
  savedData,
  isDraftDirty,
  onCommit,
}: UseGatedFeatureEditOptions) {
  const editContext = useCreationChoiceEditOptional();
  const registerDirty = editContext?.registerDirty;
  const requestEdit = editContext?.requestEdit;
  const gated = editable && editContext != null;

  const [isEditing, setIsEditing] = useState(false);
  const [draftData, setDraftData] = useState<CharacterData | null>(null);

  const workingData = isEditing && draftData ? draftData : savedData;

  const dirty = isEditing && draftData != null && isDraftDirty(savedData, draftData);

  useEffect(() => {
    if (!gated || !registerDirty) return;
    registerDirty(featureId, dirty);
    return () => registerDirty(featureId, false);
  }, [dirty, registerDirty, featureId, gated]);

  const draftApply = useCallback(
    (patch: Partial<CharacterData>) => {
      setDraftData((current) => {
        if (!current) return current;
        return {
          ...current,
          ...patch,
          featureChoices: patch.featureChoices
            ? { ...(current.featureChoices ?? {}), ...patch.featureChoices }
            : current.featureChoices,
          speciesChoices: patch.speciesChoices
            ? { ...(current.speciesChoices ?? {}), ...patch.speciesChoices }
            : current.speciesChoices,
          backgroundChoices: patch.backgroundChoices
            ? { ...(current.backgroundChoices ?? {}), ...patch.backgroundChoices }
            : current.backgroundChoices,
        };
      });
    },
    []
  );

  const startEdit = useCallback(() => {
    if (!gated || !requestEdit) return;
    requestEdit(() => {
      setDraftData(cloneCharacterData(savedData));
      setIsEditing(true);
    });
  }, [requestEdit, gated, savedData]);

  const save = useCallback(() => {
    if (!draftData || !dirty) return;
    onCommit(draftData);
    setIsEditing(false);
    setDraftData(null);
  }, [dirty, draftData, onCommit]);

  const cancel = useCallback(() => {
    setIsEditing(false);
    setDraftData(null);
  }, []);

  return useMemo(
    () => ({
      gated,
      isEditing,
      workingData,
      startEdit,
      save,
      cancel,
      draftApply,
      canSave: dirty,
    }),
    [gated, isEditing, workingData, startEdit, save, cancel, draftApply, dirty]
  );
}
