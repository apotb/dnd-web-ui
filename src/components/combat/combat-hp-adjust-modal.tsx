"use client";

import { useState } from "react";

interface CombatHpAdjustModalProps {
  tokenLabel: string;
  currentHp: number;
  maxHp: number;
  submitting?: boolean;
  onCancel: () => void;
  onApply: (delta: number) => void;
}

function parsePositiveAmount(value: string): number | null {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function CombatHpAdjustModal({
  tokenLabel,
  currentHp,
  maxHp,
  submitting = false,
  onCancel,
  onApply,
}: CombatHpAdjustModalProps) {
  const [amount, setAmount] = useState("1");
  const parsedAmount = parsePositiveAmount(amount);
  const valid = parsedAmount != null;

  return (
    <div className="supply-picker-overlay" onClick={onCancel}>
      <div
        className="supply-picker-modal retro-box combat-hp-adjust-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="retro-box-title">Adjust HP — {tokenLabel}</p>
        <p className="retro-muted combat-hp-adjust-current">
          Current: {currentHp} / {maxHp} HP
        </p>

        <label className="combat-attack-submit-field">
          <span>Amount</span>
          <input
            type="number"
            className="candy-input"
            min={1}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={submitting}
          />
        </label>

        <div className="supply-picker-actions combat-roll-actions combat-hp-adjust-actions">
          <button type="button" className="candy-btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <div className="combat-roll-right-actions">
            <button
              type="button"
              className="candy-btn"
              disabled={submitting || !valid}
              onClick={() => valid && onApply(-parsedAmount)}
            >
              {submitting ? "…" : "Subtract HP"}
            </button>
            <button
              type="button"
              className="candy-btn"
              disabled={submitting || !valid}
              onClick={() => valid && onApply(parsedAmount)}
            >
              {submitting ? "…" : "Add HP"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
