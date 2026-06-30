"use client";

import type { GridPosition } from "@/lib/combat/movement";

interface CombatMeasureResultModalProps {
  start: GridPosition;
  end: GridPosition;
  distanceFeet: number;
  onDismiss: () => void;
}

export function CombatMeasureResultModal({
  start,
  end,
  distanceFeet,
  onDismiss,
}: CombatMeasureResultModalProps) {
  return (
    <div className="supply-picker-overlay" onClick={onDismiss}>
      <div
        className="supply-picker-modal retro-box combat-measure-result-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">Distance</p>
        <p className="retro-muted">
          From tile ({start.x + 1}, {start.y + 1}) to ({end.x + 1}, {end.y + 1}):{" "}
          <strong>{distanceFeet} ft</strong>
        </p>
        <div className="supply-picker-actions combat-roll-actions">
          <div className="combat-roll-right-actions">
            <button type="button" className="candy-btn" onClick={onDismiss}>
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
