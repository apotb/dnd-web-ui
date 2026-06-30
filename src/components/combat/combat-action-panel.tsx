"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { CombatOption } from "@/lib/combat/combat-options";
import { isImplementedCombatOption } from "@/lib/combat/combat-options";
import { Tooltip } from "@/components/ui/tooltip";

const COLUMNS = 4;
const VISIBLE_ROWS = 2;
const SCROLL_ROWS = 2;

function totalRows(optionCount: number): number {
  return Math.ceil(optionCount / COLUMNS);
}

function visibleRowCount(optionCount: number, rowOffset: number): number {
  const rows = totalRows(optionCount);
  const remainingRows = Math.max(0, rows - rowOffset);
  return Math.min(VISIBLE_ROWS, remainingRows);
}

function maxRowOffset(optionCount: number): number {
  const rows = totalRows(optionCount);
  if (rows <= VISIBLE_ROWS) return 0;
  return rows % 2 === 1 ? rows - 1 : rows - VISIBLE_ROWS;
}

interface CombatOptionPanelProps {
  title: string;
  panelClassName?: string;
  emptyMessage: string;
  options: CombatOption[];
  onSelectOption: (option: CombatOption) => void;
  selectedOptionId?: string | null;
  pendingOptionId?: string | null;
  selectionLocked?: boolean;
}

export function CombatOptionPanel({
  title,
  panelClassName,
  emptyMessage,
  options,
  onSelectOption,
  selectedOptionId = null,
  pendingOptionId = null,
  selectionLocked = false,
}: CombatOptionPanelProps) {
  const [rowOffset, setRowOffset] = useState(0);

  useEffect(() => {
    setRowOffset(0);
  }, [options]);

  const rowLimit = maxRowOffset(options.length);
  const clampedRowOffset = Math.min(rowOffset, rowLimit);
  const startIndex = clampedRowOffset * COLUMNS;
  const rowsToShow = visibleRowCount(options.length, clampedRowOffset);
  const visibleSlotCount = rowsToShow * COLUMNS;
  const visibleCells = useMemo(() => {
    const slice = options.slice(startIndex, startIndex + visibleSlotCount);
    const cells: (CombatOption | null)[] = [...slice];
    while (cells.length < visibleSlotCount) {
      cells.push(null);
    }
    return cells;
  }, [options, startIndex, visibleSlotCount]);

  const canScrollUp = clampedRowOffset > 0;
  const canScrollDown = clampedRowOffset < rowLimit;
  const showScroll = totalRows(options.length) > VISIBLE_ROWS;

  const panelBody = useMemo(() => {
    if (options.length === 0) {
      return (
        <div className="combat-attack-waiting">
          <p className="combat-attack-waiting-text">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div
        className={`combat-attack-body${
          rowsToShow < VISIBLE_ROWS ? " combat-attack-body-compact" : ""
        }`}
      >
        <div
          className={`combat-attack-grid${
            rowsToShow < VISIBLE_ROWS ? " combat-attack-grid-compact" : ""
          }`}
          style={{ gridTemplateRows: `repeat(${rowsToShow}, minmax(0, 1fr))` }}
        >
          {visibleCells.map((option, index) =>
            option ? (
              (() => {
                const isPending =
                  pendingOptionId != null && option.id === pendingOptionId;
                const isActive = selectedOptionId === option.id || isPending;
                const disabled =
                  isPending ||
                  (pendingOptionId != null && option.id !== pendingOptionId) ||
                  (selectionLocked && selectedOptionId !== option.id) ||
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
        {showScroll ? (
          <div className="combat-attack-scroll">
            <button
              type="button"
              className="combat-attack-scroll-btn"
              aria-label="Scroll up two rows"
              disabled={!canScrollUp}
              onClick={() =>
                setRowOffset((value) => Math.max(0, value - SCROLL_ROWS))
              }
            >
              <ChevronUp size={18} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              className="combat-attack-scroll-btn"
              aria-label="Scroll down two rows"
              disabled={!canScrollDown}
              onClick={() =>
                setRowOffset((value) => Math.min(rowLimit, value + SCROLL_ROWS))
              }
            >
              <ChevronDown size={18} strokeWidth={2.5} />
            </button>
          </div>
        ) : null}
      </div>
    );
  }, [
    canScrollDown,
    canScrollUp,
    emptyMessage,
    onSelectOption,
    options.length,
    rowLimit,
    rowsToShow,
    selectedOptionId,
    pendingOptionId,
    selectionLocked,
    showScroll,
    startIndex,
    visibleCells,
  ]);

  return (
    <section
      className={`combat-attack-panel${panelClassName ? ` ${panelClassName}` : ""}`}
      aria-label={title}
    >
      <div className="combat-attack-header">
        <h3 className="combat-attack-title">{title}</h3>
      </div>
      {panelBody}
    </section>
  );
}

interface CombatActionPanelProps {
  options: CombatOption[];
  onSelectOption: (option: CombatOption) => void;
  selectedOptionId?: string | null;
  pendingOptionId?: string | null;
  selectionLocked?: boolean;
}

export function CombatActionPanel({
  options,
  onSelectOption,
  selectedOptionId,
  pendingOptionId,
  selectionLocked,
}: CombatActionPanelProps) {
  return (
    <CombatOptionPanel
      title="Action"
      emptyMessage="No actions available."
      options={options}
      onSelectOption={onSelectOption}
      selectedOptionId={selectedOptionId}
      pendingOptionId={pendingOptionId}
      selectionLocked={selectionLocked}
    />
  );
}

interface CombatBonusActionPanelProps {
  options: CombatOption[];
  onSelectOption: (option: CombatOption) => void;
  selectedOptionId?: string | null;
  pendingOptionId?: string | null;
  selectionLocked?: boolean;
}

export function CombatBonusActionPanel({
  options,
  onSelectOption,
  selectedOptionId,
  pendingOptionId,
  selectionLocked,
}: CombatBonusActionPanelProps) {
  return (
    <CombatOptionPanel
      title="Bonus Action"
      panelClassName="combat-bonus-action-panel"
      emptyMessage="No bonus actions available."
      options={options}
      onSelectOption={onSelectOption}
      selectedOptionId={selectedOptionId}
      pendingOptionId={pendingOptionId}
      selectionLocked={selectionLocked}
    />
  );
}
