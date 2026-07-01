"use client";

interface CombatDashConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  movementGainedFeet: number;
  /** Confirming dash to reach a movement destination beyond normal range. */
  forDestination?: boolean;
}

export function CombatDashConfirmModal({
  onConfirm,
  onCancel,
  movementGainedFeet,
  forDestination = false,
}: CombatDashConfirmModalProps) {
  const intro = forDestination
    ? "Use Dash to reach this tile?"
    : "Use Dash?";

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-roll-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">Dash</p>
        <div className="combat-roll-body">
          <p className="combat-roll-line">
            {intro} This will consume your action and grant{" "}
            <strong>+{movementGainedFeet} ft</strong> movement.
          </p>
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
