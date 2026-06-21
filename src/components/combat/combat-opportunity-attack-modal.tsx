"use client";

interface CombatOpportunityAttackModalProps {
  reactorLabels: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function CombatOpportunityAttackModal({
  reactorLabels,
  onConfirm,
  onCancel,
}: CombatOpportunityAttackModalProps) {
  const reactorList =
    reactorLabels.length === 1
      ? reactorLabels[0]
      : reactorLabels.length === 2
        ? `${reactorLabels[0]} and ${reactorLabels[1]}`
        : `${reactorLabels.slice(0, -1).join(", ")}, and ${reactorLabels.at(-1)}`;

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-opportunity-attack-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">Opportunity attacks?</p>
        <p className="retro-muted">
          Leaving engagement may provoke opportunity attacks from {reactorList}. Use the
          Disengage action instead to move without provoking attacks this turn.
        </p>
        <div
          className="supply-picker-actions"
          style={{ gap: "8px", justifyContent: "flex-end" }}
        >
          <button type="button" className="candy-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="candy-btn" onClick={onConfirm}>
            Move anyway
          </button>
        </div>
      </div>
    </div>
  );
}
