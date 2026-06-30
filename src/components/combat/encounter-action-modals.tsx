"use client";

import { ConfirmModal } from "@/components/ui/confirm-modal";
import { EncounterNameModal } from "@/components/combat/encounter-name-modal";
import type { EncounterListItem } from "@/lib/combat/saved-encounters";

interface EncounterRenameModalProps {
  encounter: EncounterListItem | null;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}

export function EncounterRenameModal({
  encounter,
  submitting = false,
  onCancel,
  onSubmit,
}: EncounterRenameModalProps) {
  if (!encounter) return null;

  return (
    <EncounterNameModal
      title="Rename encounter"
      description={`Enter a new name for "${encounter.name}".`}
      initialName={encounter.name}
      placeholder="Encounter name"
      submitLabel="Rename"
      submitting={submitting}
      onCancel={onCancel}
      onSubmit={onSubmit}
    />
  );
}

interface EncounterDeleteConfirmModalProps {
  encounter: EncounterListItem | null;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function EncounterDeleteConfirmModal({
  encounter,
  submitting = false,
  onCancel,
  onConfirm,
}: EncounterDeleteConfirmModalProps) {
  return (
    <ConfirmModal
      open={encounter != null}
      title="Delete encounter?"
      description={
        encounter
          ? `Delete "${encounter.name}"? This cannot be undone.`
          : ""
      }
      confirmLabel={submitting ? "Deleting…" : "Delete"}
      confirmDisabled={submitting}
      destructive
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
