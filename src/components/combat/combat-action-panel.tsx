"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { CombatOption } from "@/lib/combat/combat-options";
import { isImplementedCombatOption } from "@/lib/combat/combat-options";
import { Tooltip } from "@/components/ui/tooltip";

const COLUMNS = 4;
const DEFAULT_VISIBLE_ROWS = 2;

function totalRows(optionCount: number): number {
  return Math.ceil(optionCount / COLUMNS);
}

function maxRowOffset(optionCount: number, visibleRows: number): number {
  const rows = totalRows(optionCount);
  if (rows <= visibleRows) return 0;
  if (visibleRows === 1) return rows - 1;
  return rows % 2 === 1 ? rows - 1 : rows - visibleRows;
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
  visibleRows?: number;
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
  visibleRows = DEFAULT_VISIBLE_ROWS,
}: CombatOptionPanelProps) {
  const [rowOffset, setRowOffset] = useState(0);

  useEffect(() => {
    setRowOffset(0);
  }, [options]);

  const rowLimit = maxRowOffset(options.length, visibleRows);
  const clampedRowOffset = Math.min(rowOffset, rowLimit);
  const startIndex = clampedRowOffset * COLUMNS;
  const visibleSlotCount = visibleRows * COLUMNS;
  const scrollRows = visibleRows;
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
  const showScroll = totalRows(options.length) > visibleRows;
  const singleRowPanel = visibleRows === 1;

  const panelBody = useMemo(() => {
    if (options.length === 0) {
      return (
        <div className="combat-attack-waiting">
          <p className="combat-attack-waiting-text">{emptyMessage}</p>
        </div>
      );
    }

    return (
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
        <div
          className={`combat-attack-scroll${showScroll ? "" : " combat-attack-scroll-reserved"}`}
          aria-hidden={!showScroll}
        >
          <button
            type="button"
            className="combat-attack-scroll-btn"
            aria-label={`Scroll up ${scrollRows} row${scrollRows === 1 ? "" : "s"}`}
            disabled={!showScroll || !canScrollUp}
            onClick={() =>
              setRowOffset((value) => Math.max(0, value - scrollRows))
            }
          >
            <ChevronUp size={18} strokeWidth={2.5} />
          </button>
          <button
            type="button"
            className="combat-attack-scroll-btn"
            aria-label={`Scroll down ${scrollRows} row${scrollRows === 1 ? "" : "s"}`}
            disabled={!showScroll || !canScrollDown}
            onClick={() =>
              setRowOffset((value) => Math.min(rowLimit, value + scrollRows))
            }
          >
            <ChevronDown size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  }, [
    canScrollDown,
    canScrollUp,
    emptyMessage,
    onSelectOption,
    options.length,
    rowLimit,
    scrollRows,
    selectedOptionId,
    pendingOptionId,
    selectionLocked,
    showScroll,
    startIndex,
    visibleCells,
  ]);

  return (
    <section
      className={`combat-attack-panel${
        singleRowPanel ? " combat-attack-panel-single-row" : ""
      }${panelClassName ? ` ${panelClassName}` : ""}`}
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

interface CombatSavingThrowsPanelProps {
  options: CombatOption[];
  onSelectOption: (option: CombatOption) => void;
  selectedOptionId?: string | null;
  pendingOptionId?: string | null;
  selectionLocked?: boolean;
}

export function CombatSavingThrowsPanel({
  options,
  onSelectOption,
  selectedOptionId,
  pendingOptionId,
  selectionLocked,
}: CombatSavingThrowsPanelProps) {
  return (
    <CombatOptionPanel
      title="Saving Throws"
      emptyMessage="No saving throws available."
      options={options}
      onSelectOption={onSelectOption}
      selectedOptionId={selectedOptionId}
      pendingOptionId={pendingOptionId}
      selectionLocked={selectionLocked}
      visibleRows={1}
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

interface CombatMultiattackPanelProps {
  options: CombatOption[];
  preamble?: string;
  onSelectOption: (option: CombatOption) => void;
  selectedOptionId?: string | null;
  pendingOptionId?: string | null;
  selectionLocked?: boolean;
}

export function CombatMultiattackPanel({
  options,
  preamble,
  onSelectOption,
  selectedOptionId,
  pendingOptionId,
  selectionLocked,
}: CombatMultiattackPanelProps) {
  return (
    <CombatOptionPanel
      title="Multiattack"
      panelClassName="combat-multiattack-panel"
      emptyMessage={
        preamble
          ? `${preamble} — choose a branch to begin.`
          : "Choose a Multiattack branch to begin."
      }
      options={options}
      onSelectOption={onSelectOption}
      selectedOptionId={selectedOptionId}
      pendingOptionId={pendingOptionId}
      selectionLocked={selectionLocked}
      visibleRows={1}
    />
  );
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
      visibleRows={1}
    />
  );
}
