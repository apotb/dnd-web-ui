"use client";

import type { MultiattackBranch } from "@/lib/combat/multiattack";

interface CombatMultiattackBranchModalProps {
  branches: MultiattackBranch[];
  preamble?: string;
  onSelectBranch: (branchIndex: number) => void;
  onCancel: () => void;
}

export function CombatMultiattackBranchModal({
  branches,
  preamble,
  onSelectBranch,
  onCancel,
}: CombatMultiattackBranchModalProps) {
  return (
    <div className="combat-modal-backdrop" role="presentation">
      <div
        className="combat-modal combat-multiattack-branch-modal"
        role="dialog"
        aria-labelledby="combat-multiattack-branch-title"
      >
        <h2 id="combat-multiattack-branch-title" className="combat-modal-title">
          Choose Multiattack
        </h2>
        {preamble ? <p className="combat-modal-description">{preamble}</p> : null}
        <ul className="combat-multiattack-branch-list">
          {branches.map((branch, index) => (
            <li key={branch.label}>
              <button
                type="button"
                className="combat-multiattack-branch-option"
                onClick={() => onSelectBranch(index)}
              >
                {branch.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="combat-modal-actions">
          <button type="button" className="retro-btn retro-btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
