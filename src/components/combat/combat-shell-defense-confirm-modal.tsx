"use client";

interface CombatShellDefenseConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function CombatShellDefenseConfirmModal({
  onConfirm,
  onCancel,
}: CombatShellDefenseConfirmModalProps) {
  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-roll-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">Shell Defense</p>
        <div className="combat-roll-body">
          <p className="combat-roll-line">
            Withdraw into your shell? This consumes your action for this turn.
          </p>
          <ul className="combat-shell-defense-effects retro-muted">
            <li>+4 AC, prone, speed 0</li>
            <li>Advantage on Strength and Constitution saves</li>
            <li>Disadvantage on Dexterity saves</li>
            <li>No reactions until you emerge</li>
            <li>Emerge on a later turn using your bonus action</li>
          </ul>
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
