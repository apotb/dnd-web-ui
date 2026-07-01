"use client";

import { useCreationChoiceEdit } from "@/components/character/creation-choice-edit-context";
import { useUnsavedChangesGuard } from "@/lib/hooks/use-unsaved-changes-guard";

export function CreationChoiceUnsavedGuard() {
  const { hasUnsavedEdits } = useCreationChoiceEdit();

  useUnsavedChangesGuard({
    dirty: hasUnsavedEdits,
    message: "You have unsaved character creation choice changes. Leave without saving?",
  });

  return null;
}
