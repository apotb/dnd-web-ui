"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { CombatOption } from "@/lib/combat/combat-options";
import { isImplementedCombatOption } from "@/lib/combat/combat-options";
import { Tooltip } from "@/components/ui/tooltip";

const COLUMNS = 4;
const VISIBLE_ROWS = 2;
const SCROLL_ROWS = 2;
const VISIBLE_SLOTS = COLUMNS * VISIBLE_ROWS;

function totalRows(optionCount: number): number {
  return Math.ceil(optionCount / COLUMNS);
}

function maxRowOffset(optionCount: number): number {
  const rows = totalRows(optionCount);
  if (rows <= VISIBLE_ROWS) return 0;
  return rows % 2 === 1 ? rows - 1 : rows - VISIBLE_ROWS;
}

interface CombatOpportunityAttackPanelProps {
  provokingLabel: string;
  options: CombatOption[];
  onSelectOption: (option: CombatOption) => void;
  onSkip: () => void;
  selectedOptionId?: string | null;
  pendingOptionId?: string | null;
  selectionLocked?: boolean;
  skipping?: boolean;
}

export function CombatOpportunityAttackPanel({
  provokingLabel,
  options,
  onSelectOption,
  onSkip,
  selectedOptionId = null,
  pendingOptionId = null,
  selectionLocked = false,
  skipping = false,
}: CombatOpportunityAttackPanelProps) {
  const [rowOffset, setRowOffset] = useState(0);

  useEffect(() => {
    setRowOffset(0);
  }, [options]);

  const rowLimit = maxRowOffset(options.length);
  const clampedRowOffset = Math.min(rowOffset, rowLimit);
  const startIndex = clampedRowOffset * COLUMNS;
  const visibleCells = useMemo(() => {
    const slice = options.slice(startIndex, startIndex + VISIBLE_SLOTS);
    const cells: (CombatOption | null)[] = [...slice];
    while (cells.length < VISIBLE_SLOTS) {
      cells.push(null);
    }
    return cells;
  }, [options, startIndex]);

  const canScrollUp = clampedRowOffset > 0;
  const canScrollDown = clampedRowOffset < rowLimit;
  const showScroll = totalRows(options.length) > VISIBLE_ROWS;

  return (
    <section className="combat-attack-panel combat-opportunity-attack-panel" aria-label="Opportunity Attack">
      <div className="combat-attack-header">
        <h3 className="combat-attack-title">Opportunity Attack</h3>
        <p className="combat-attack-subtitle">
          {provokingLabel} moved away. Make a melee attack or skip.
        </p>
      </div>
      {options.length === 0 ? (
        <div className="combat-attack-waiting">
          <p className="combat-attack-waiting-text">No melee attacks available.</p>
        </div>
      ) : (
        <div className="combat-attack-body">
          <div className="combat-attack-grid">
            {visibleCells.map((option, index) =>
              option ? (
                (() => {
                  const isPending =
                    pendingOptionId != null && option.id === pendingOptionId;
                  const isActive = selectedOptionId === option.id || isPending;
                  const disabled =
                    isPending ||
                    pendingOptionId != null ||
                    selectionLocked ||
                    !isImplementedCombatOption(option);

                  return (
                    <Tooltip key={option.id} content={option.tooltip}>
                      <button
                        type="button"
                        className={`combat-attack-option${
                          isActive ? " combat-attack-option-active" : ""
                        }${isPending ? " combat-attack-option-pending" : ""}`}
                        disabled={disabled}
                        onClick={() => onSelectOption(option)}
                      >
                        <span className="combat-attack-option-name">{option.name}</span>
                        <span className="combat-attack-option-sub">
                          {isPending ? "Pending…" : option.subtitle}
                        </span>
                      </button>
                    </Tooltip>
                  );
                })()
              ) : (
                <div
                  key={`empty-${startIndex + index}`}
                  className="combat-attack-option-empty"
                  aria-hidden
                />
              )
            )}
          </div>
          <div
            className={`combat-attack-scroll${showScroll ? "" : " combat-attack-scroll-reserved"}`}
            aria-hidden={!showScroll}
          >
            <button
              type="button"
              className="combat-attack-scroll-btn"
              aria-label="Scroll up two rows"
              disabled={!showScroll || !canScrollUp}
              onClick={() => setRowOffset((value) => Math.max(0, value - SCROLL_ROWS))}
            >
              <ChevronUp size={18} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              className="combat-attack-scroll-btn"
              aria-label="Scroll down two rows"
              disabled={!showScroll || !canScrollDown}
              onClick={() => setRowOffset((value) => Math.min(rowLimit, value + SCROLL_ROWS))}
            >
              <ChevronDown size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}
      <div className="combat-opportunity-attack-skip-row">
        <button
          type="button"
          className="candy-btn"
          disabled={selectionLocked || skipping}
          onClick={onSkip}
        >
          {skipping ? "Skipping…" : "Skip"}
        </button>
      </div>
    </section>
  );
}
