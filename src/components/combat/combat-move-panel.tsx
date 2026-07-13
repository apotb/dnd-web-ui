"use client";

import {
  buildDashCombatOption,
  buildMoveCombatOption,
  isGetUpAffordable,
} from "@/lib/combat/combat-options";
import type { CombatOption } from "@/lib/combat/combat-options";
import { Tooltip } from "@/components/ui/tooltip";

interface CombatMovePanelProps {
  proneMode?: boolean;
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
  crawlOption?: CombatOption | null;
  getUpOption?: CombatOption | null;
  onSelectGetUp?: () => void;
}

export function CombatMovePanel({
  proneMode = false,
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
  crawlOption = null,
  getUpOption = null,
  onSelectGetUp,
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

  const crawlDisabled = disabled || !crawlOption?.crawl?.affordable;
  const getUpDisabled =
    disabled || !getUpOption || !isGetUpAffordable(getUpOption);

  return (
    <section className="combat-move-panel" aria-label="Movement">
      <div className="combat-move-header">
        <h3 className="combat-move-title">Movement</h3>
      </div>
      <div className="combat-attack-body">
        <div className="combat-move-options">
          {proneMode ? (
            <>
              {crawlOption ? (
                <Tooltip content={crawlOption.tooltip}>
                  <button
                    type="button"
                    className={`combat-attack-option${
                      movementMode ? " combat-attack-option-active" : ""
                    }`}
                    disabled={crawlDisabled}
                    onClick={onToggleMovementMode}
                  >
                    <span className="combat-attack-option-name">{crawlOption.name}</span>
                    <span className="combat-attack-option-sub">{crawlOption.subtitle}</span>
                  </button>
                </Tooltip>
              ) : null}
              {getUpOption ? (
                <Tooltip content={getUpOption.tooltip}>
                  <button
                    type="button"
                    className="combat-attack-option"
                    disabled={getUpDisabled}
                    onClick={onSelectGetUp}
                  >
                    <span className="combat-attack-option-name">{getUpOption.name}</span>
                    <span className="combat-attack-option-sub">{getUpOption.subtitle}</span>
                  </button>
                </Tooltip>
              ) : null}
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
        <div
          className="combat-attack-scroll combat-attack-scroll-reserved"
          aria-hidden="true"
        />
      </div>
    </section>
  );
}
