"use client";

import { useMemo } from "react";
import {
  getAoeCells,
  parseAttackRangeSpec,
  type AttackRangeSpec,
} from "@/lib/combat/targeting";
import type { DerivedAttack } from "@/lib/dnd/attacks";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";

interface CombatTargetingOverlayProps {
  gridWidth: number;
  gridHeight: number;
  attacker: CombatToken;
  attack: DerivedAttack;
  state: CombatState;
  validTargets: CombatToken[];
  validCells: Array<{ x: number; y: number }>;
  hoveredCell: { x: number; y: number } | null;
  previewCenter: { x: number; y: number } | null;
  onTargetClick: (token: CombatToken) => void;
  onCellClick: (cell: { x: number; y: number }) => void;
  onCellHover: (cell: { x: number; y: number } | null) => void;
  onCancel: () => void;
}

export function CombatTargetingOverlay({
  gridWidth,
  gridHeight,
  attacker,
  attack,
  state,
  validTargets,
  validCells,
  hoveredCell,
  previewCenter,
  onTargetClick,
  onCellClick,
  onCellHover,
  onCancel,
}: CombatTargetingOverlayProps) {
  const spec: AttackRangeSpec = useMemo(() => parseAttackRangeSpec(attack), [attack]);
  const validCellSet = useMemo(
    () => new Set(validCells.map((cell) => `${cell.x},${cell.y}`)),
    [validCells]
  );

  const aoePreviewCells = useMemo(() => {
    if (!spec.isAoe || !previewCenter) return new Set<string>();
    const cells = getAoeCells(attacker, previewCenter, spec, state);
    return new Set(cells.map((cell) => `${cell.x},${cell.y}`));
  }, [attacker, previewCenter, spec, state]);

  const aoeHoverCells = useMemo(() => {
    if (!spec.isAoe || !hoveredCell) return new Set<string>();
    const cells = getAoeCells(attacker, hoveredCell, spec, state);
    return new Set(cells.map((cell) => `${cell.x},${cell.y}`));
  }, [attacker, hoveredCell, spec, state]);

  const highlightCells = spec.isAoe ? aoeHoverCells : aoePreviewCells;

  return (
    <div
      className="combat-targeting-overlay"
      style={{
        ["--grid-width" as string]: gridWidth,
        ["--grid-height" as string]: gridHeight,
      }}
      onMouseLeave={() => onCellHover(null)}
    >
      {Array.from({ length: gridHeight }).flatMap((_, y) =>
        Array.from({ length: gridWidth }).map((_, x) => {
          const key = `${x},${y}`;
          const isValidCell = validCellSet.has(key);
          const isAoeHighlight = highlightCells.has(key);
          if (!isValidCell && !isAoeHighlight) return null;

          return (
            <button
              key={key}
              type="button"
              className={`combat-targeting-cell${
                isAoeHighlight ? " combat-targeting-cell-aoe-preview" : ""
              }`}
              style={{ gridColumn: x + 1, gridRow: y + 1 }}
              aria-label={`Target tile ${x + 1}, ${y + 1}`}
              onMouseEnter={() => onCellHover({ x, y })}
              onClick={() => onCellClick({ x, y })}
            />
          );
        })
      )}

      {validTargets.map((token) => (
        <button
          key={token.id}
          type="button"
          className="combat-targeting-token-highlight"
          style={{
            gridColumn: `${token.x + 1} / span ${token.width}`,
            gridRow: `${token.y + 1} / span ${token.height}`,
          }}
          aria-label={`Target ${token.label}`}
          onClick={() => onTargetClick(token)}
        />
      ))}

      <div className="combat-targeting-banner">
        <span>Select a target for {attack.name}</span>
        <button type="button" className="candy-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
