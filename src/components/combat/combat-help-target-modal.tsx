"use client";

import type { CombatToken } from "@/lib/schemas/combat-state";
import { getCombatTokenDisplayLabel } from "@/lib/combat/party-token-label";

interface CombatHelpTargetModalProps {
  allies: CombatToken[];
  resolvePortraitUrl: (token: CombatToken) => string | null;
  onSelect: (ally: CombatToken) => void;
  onCancel: () => void;
}

export function CombatHelpTargetModal({
  allies,
  resolvePortraitUrl,
  onSelect,
  onCancel,
}: CombatHelpTargetModalProps) {
  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-help-target-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">Help</p>
        <p className="retro-muted">
          Choose an ally within 5 feet to grant advantage on their next attack
          against a target within 5 feet of you.
        </p>
        <ul className="combat-help-target-list">
          {allies.map((ally) => {
            const portraitUrl = resolvePortraitUrl(ally);
            const displayLabel = getCombatTokenDisplayLabel(ally);
            return (
              <li key={ally.id}>
                <button
                  type="button"
                  className="combat-help-target-option"
                  onClick={() => onSelect(ally)}
                >
                  {portraitUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={portraitUrl}
                      alt=""
                      className="combat-help-target-portrait"
                      draggable={false}
                    />
                  ) : (
                    <div
                      className="combat-help-target-portrait combat-help-target-portrait-fallback"
                      aria-hidden
                    >
                      {displayLabel.slice(0, 1)}
                    </div>
                  )}
                  <span className="combat-help-target-name">{displayLabel}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="supply-picker-actions">
          <button type="button" className="candy-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
