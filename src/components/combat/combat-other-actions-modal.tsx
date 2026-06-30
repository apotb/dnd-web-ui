"use client";

import { getCombatOtherActionEntries } from "@/lib/combat/combat-options";

interface CombatOtherActionsModalProps {
  onCancel: () => void;
  onUse: () => void;
}

export function CombatOtherActionsModal({ onCancel, onUse }: CombatOtherActionsModalProps) {
  const entries = getCombatOtherActionEntries();

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-roll-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">Other Actions</p>

        <div className="combat-roll-body">
          <p className="combat-roll-line retro-muted">
            Declare which action you are taking to the DM before using your action.
          </p>

          <div className="combat-other-action-list">
            {entries.map((entry) => (
              <div key={entry.id} className="combat-other-action-entry">
                <p className="combat-roll-line">
                  <strong>{entry.name}</strong>
                </p>
                <p className="combat-roll-line retro-muted">{entry.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="supply-picker-actions combat-roll-actions">
          <button type="button" className="candy-btn" onClick={onCancel}>
            Cancel
          </button>
          <div className="combat-roll-right-actions">
            <button type="button" className="candy-btn" onClick={onUse}>
              Use Action
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
