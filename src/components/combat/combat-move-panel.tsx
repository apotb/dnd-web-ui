"use client";

import { buildMoveCombatOption } from "@/lib/combat/combat-options";
import { Tooltip } from "@/components/ui/tooltip";

interface CombatMovePanelProps {
  remainingFeet: number;
  speedFeet: number;
  dashAvailableFeet: number | null;
  dashUsed: boolean;
  movementMode: boolean;
  disabled?: boolean;
  onToggleMovementMode: () => void;
}

export function CombatMovePanel({
  remainingFeet,
  speedFeet,
  dashAvailableFeet,
  dashUsed,
  movementMode,
  disabled = false,
  onToggleMovementMode,
}: CombatMovePanelProps) {
  const option = buildMoveCombatOption({
    remainingFeet,
    speedFeet,
    dashAvailableFeet,
    dashUsed,
  });

  return (
    <section className="combat-move-panel" aria-label="Move">
      <div className="combat-move-header">
        <h3 className="combat-move-title">Move</h3>
      </div>
      <div className="combat-move-options">
        <Tooltip content={option.tooltip}>
          <button
            type="button"
            className={`combat-attack-option${
              movementMode ? " combat-attack-option-active" : ""
            }`}
            disabled={disabled}
            onClick={onToggleMovementMode}
          >
            <span className="combat-attack-option-name">{option.name}</span>
            <span className="combat-attack-option-sub">{option.subtitle}</span>
          </button>
        </Tooltip>
      </div>
    </section>
  );
}
