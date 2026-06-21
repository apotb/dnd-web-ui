"use client";

interface CombatDashConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  message?: string;
}

export function CombatDashConfirmModal({
  onConfirm,
  onCancel,
  message = "Use Dash to reach this tile? This will consume your action for this turn.",
}: CombatDashConfirmModalProps) {
  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-roll-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">Dash</p>
        <div className="combat-roll-body">
          <p className="combat-roll-line">{message}</p>
        </div>
        <div className="supply-picker-actions combat-roll-actions">
          <button type="button" className="candy-btn" onClick={onCancel}>
            Cancel
          </button>
          <div className="combat-roll-right-actions">
            <button type="button" className="candy-btn" onClick={onConfirm}>
              Use Action
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
