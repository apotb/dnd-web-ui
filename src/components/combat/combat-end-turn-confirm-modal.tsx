"use client";

interface CombatEndTurnConfirmModalProps {
  nextTurnLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  endingTurn: boolean;
}

export function CombatEndTurnConfirmModal({
  nextTurnLabel,
  onConfirm,
  onCancel,
  endingTurn,
}: CombatEndTurnConfirmModalProps) {
  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-end-turn-confirm-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">End Turn?</p>
        <p className="retro-muted">End your turn. {nextTurnLabel} will go next.</p>
        <div className="supply-picker-actions combat-roll-actions">
          <button type="button" className="candy-btn" onClick={onCancel} disabled={endingTurn}>
            Cancel
          </button>
          <div className="combat-roll-right-actions">
            <button
              type="button"
              className="candy-btn"
              onClick={onConfirm}
              disabled={endingTurn}
            >
              {endingTurn ? "Ending…" : "End Turn"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
