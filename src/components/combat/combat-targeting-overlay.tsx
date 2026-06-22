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
  hoveredTokenLabel?: string | null;
  hoveredTokenDetail?: string | null;
  onPointerMove: (clientX: number, clientY: number) => void;
  onPointerLeave: () => void;
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
  hoveredTokenLabel = null,
  hoveredTokenDetail = null,
  onPointerMove,
  onPointerLeave,
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

  function handleOverlayPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    onPointerMove(event.clientX, event.clientY);

    const target = event.target as HTMLElement;
    if (target.closest(".combat-targeting-banner")) {
      onCellHover(null);
      return;
    }

    const overlay = event.currentTarget;
    const rect = overlay.getBoundingClientRect();
    const x = Math.floor(
      ((event.clientX - rect.left) / rect.width) * gridWidth
    );
    const y = Math.floor(
      ((event.clientY - rect.top) / rect.height) * gridHeight
    );

    if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) {
      onCellHover(null);
      return;
    }

    onCellHover({ x, y });
  }

  function handleOverlayPointerLeave() {
    onPointerLeave();
    onCellHover(null);
  }

  return (
    <div
      className="combat-targeting-overlay"
      style={{
        ["--grid-width" as string]: gridWidth,
        ["--grid-height" as string]: gridHeight,
      }}
      onPointerMove={handleOverlayPointerMove}
      onPointerLeave={handleOverlayPointerLeave}
    >
      {Array.from({ length: gridHeight }).flatMap((_, y) =>
        Array.from({ length: gridWidth }).map((_, x) => {
          const key = `${x},${y}`;
          const isValidCell = validCellSet.has(key);
          const isAoeHighlight = highlightCells.has(key);
          if (!isValidCell && !isAoeHighlight) return null;

          return (
            <div
              key={key}
              className={`combat-targeting-cell${
                isAoeHighlight ? " combat-targeting-cell-aoe-preview" : ""
              }`}
              style={{ gridColumn: x + 1, gridRow: y + 1 }}
              aria-hidden
            />
          );
        })
      )}

      {validTargets.map((token) => (
        <div
          key={token.id}
          className="combat-targeting-token-highlight"
          style={{
            gridColumn: `${token.x + 1} / span ${token.width}`,
            gridRow: `${token.y + 1} / span ${token.height}`,
          }}
          aria-hidden
        />
      ))}

      <div className="combat-targeting-banner">
        <div className="combat-targeting-banner-text">
          <span>
            {validTargets.length === 0 && validCells.length === 0
              ? `No targets in range for ${attack.name}`
              : `Select a target for ${attack.name}`}
          </span>
          {hoveredTokenLabel ? (
            <span className="combat-targeting-banner-hover">
              {hoveredTokenLabel}
              {hoveredTokenDetail ? ` · ${hoveredTokenDetail}` : ""}
            </span>
          ) : null}
        </div>
        <button type="button" className="candy-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
