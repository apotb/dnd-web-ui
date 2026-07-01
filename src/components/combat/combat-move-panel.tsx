"use client";

import {
  buildDashCombatOption,
  buildMoveCombatOption,
} from "@/lib/combat/combat-options";
import { Tooltip } from "@/components/ui/tooltip";

interface CombatMovePanelProps {
  remainingFeet: number;
  speedFeet: number;
  dashAvailableFeet: number | null;
  dashUsed: boolean;
  showDash: boolean;
  movementMode: boolean;
  disabled?: boolean;
  dashDisabled?: boolean;
  onToggleMovementMode: () => void;
  onSelectDash: () => void;
}

export function CombatMovePanel({
  remainingFeet,
  speedFeet,
  dashAvailableFeet,
  dashUsed,
  showDash,
  movementMode,
  disabled = false,
  dashDisabled = false,
  onToggleMovementMode,
  onSelectDash,
}: CombatMovePanelProps) {
  const moveOption = buildMoveCombatOption({
    remainingFeet,
    speedFeet,
    dashAvailableFeet,
    dashUsed,
  });
  const dashOption = buildDashCombatOption({
    speedFeet,
    dashUsed,
  });

  return (
    <section className="combat-move-panel" aria-label="Move">
      <div className="combat-move-header">
        <h3 className="combat-move-title">Move</h3>
      </div>
      <div className="combat-attack-body">
        <div className="combat-move-options">
          <Tooltip content={moveOption.tooltip}>
            <button
              type="button"
              className={`combat-attack-option${
                movementMode ? " combat-attack-option-active" : ""
              }`}
              disabled={disabled}
              onClick={onToggleMovementMode}
            >
              <span className="combat-attack-option-name">{moveOption.name}</span>
              <span className="combat-attack-option-sub">{moveOption.subtitle}</span>
            </button>
          </Tooltip>
          {showDash ? (
            <Tooltip content={dashOption.tooltip}>
              <button
                type="button"
                className="combat-attack-option"
                disabled={disabled || dashDisabled}
                onClick={onSelectDash}
              >
                <span className="combat-attack-option-name">{dashOption.name}</span>
                <span className="combat-attack-option-sub">{dashOption.subtitle}</span>
              </button>
            </Tooltip>
          ) : null}
        </div>
        <div
          className="combat-attack-scroll combat-attack-scroll-reserved"
          aria-hidden="true"
        />
      </div>
    </section>
  );
}
