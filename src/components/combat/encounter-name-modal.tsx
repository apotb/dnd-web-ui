"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface EncounterNameModalProps {
  title?: string;
  description?: string;
  initialName?: string;
  placeholder?: string;
  submitLabel?: string;
  submitting?: boolean;
  onCancel: () => void;
  onSubmit: (name: string) => void;
}

export function EncounterNameModal({
  title = "Save encounter",
  description = "Enter a name for this encounter setup.",
  initialName = "",
  placeholder = "Encounter name",
  submitLabel = "Save",
  submitting = false,
  onCancel,
  onSubmit,
}: EncounterNameModalProps) {
  const [name, setName] = useState(initialName);
  const trimmedName = name.trim();
  const canSubmit = trimmedName.length > 0 && !submitting;

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(trimmedName);
  }

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-encounter-name-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">{title}</p>
        {description ? <p className="retro-muted">{description}</p> : null}

        <label className="combat-marker-dialog-field">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={placeholder}
            autoFocus
            disabled={submitting}
            aria-label="Encounter name"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleSubmit();
              }
            }}
          />
        </label>

        <div className="supply-picker-actions combat-roll-actions">
          <button type="button" className="candy-btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <div className="combat-roll-right-actions">
            <button
              type="button"
              className="candy-btn"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {submitting ? "Saving…" : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
