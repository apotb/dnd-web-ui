"use client";

import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveCombatImageUrl } from "@/lib/combat/storage";
import {
  enrichEncountersForList,
  formatTotalCr,
} from "@/lib/combat/saved-encounters";
import type { EnemyRecord } from "@/lib/combat/state-utils";
import type { Encounter } from "@/lib/types/database";

interface EncounterOverwriteConfirmModalProps {
  encounter: Encounter | null;
  enemiesBySlug: Record<string, Pick<EnemyRecord, "name">>;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function EncounterOverwriteConfirmModal({
  encounter,
  enemiesBySlug,
  submitting = false,
  onCancel,
  onConfirm,
}: EncounterOverwriteConfirmModalProps) {
  const supabase = useMemo(() => createClient(), []);

  if (!encounter) return null;

  const preview = enrichEncountersForList([encounter], enemiesBySlug)[0];
  const backgroundUrl = encounter.background_path
    ? resolveCombatImageUrl(supabase, encounter.background_path)
    : null;

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-encounter-overwrite-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">Overwrite encounter?</p>
        <p className="retro-muted">
          An encounter named <strong>{encounter.name}</strong> already exists. Overwrite it with
          your current board?
        </p>

        <div className="combat-encounter-load-item combat-encounter-overwrite-preview">
          <div className="combat-encounter-load-preview">
            {backgroundUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={backgroundUrl} alt="" className="combat-encounter-load-preview-image" />
            ) : (
              <div className="combat-encounter-load-preview-placeholder">No background</div>
            )}
          </div>

          <div className="combat-encounter-load-details">
            <div className="combat-encounter-load-header">
              <h3>{preview.name}</h3>
              <span className="combat-encounter-load-meta">CR {formatTotalCr(preview.total_cr)}</span>
            </div>

            {preview.enemySummary.length > 0 ? (
              <p className="combat-encounter-load-enemies">{preview.enemySummary.join(", ")}</p>
            ) : (
              <p className="combat-encounter-load-enemies retro-muted">No enemies</p>
            )}

            <p className="combat-encounter-load-counts retro-muted">
              {preview.grid_width}×{preview.grid_height} grid
              {" · "}
              {preview.characterSlotCount} character token
              {preview.characterSlotCount === 1 ? "" : "s"}
              {preview.markerCount > 0
                ? ` · ${preview.markerCount} marker${preview.markerCount === 1 ? "" : "s"}`
                : ""}
            </p>
          </div>
        </div>

        <div className="supply-picker-actions combat-roll-actions">
          <button type="button" className="candy-btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <div className="combat-roll-right-actions">
            <button type="button" className="candy-btn" onClick={onConfirm} disabled={submitting}>
              {submitting ? "Saving…" : "Overwrite"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
