"use client";

interface CombatEndTurnPanelProps {
  nextTurnLabel: string;
  onSelectEndTurn: () => void;
  endingTurn: boolean;
  disabled?: boolean;
}

export function CombatEndTurnPanel({
  nextTurnLabel,
  onSelectEndTurn,
  endingTurn,
  disabled = false,
}: CombatEndTurnPanelProps) {
  return (
    <section className="combat-end-turn-panel" aria-label="End Turn">
      <div className="combat-end-turn-header">
        <h3 className="combat-end-turn-title">End Turn</h3>
      </div>
      <div className="combat-end-turn-options">
        <button
          type="button"
          className="combat-attack-option"
          onClick={onSelectEndTurn}
          disabled={endingTurn || disabled}
        >
          <span className="combat-attack-option-name">End Turn</span>
          <span className="combat-attack-option-sub">Next: {nextTurnLabel}</span>
        </button>
      </div>
    </section>
  );
}
