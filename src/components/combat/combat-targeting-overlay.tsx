"use client";

import { useMemo } from "react";
import {
  getAoeCells,
  parseAttackRangeSpec,
  type AttackRangeSpec,
  type RangedAttackCellZone,
} from "@/lib/combat/targeting";
import type { DerivedAttack } from "@/lib/dnd/attacks";
import type { CombatState, CombatToken } from "@/lib/schemas/combat-state";

interface CombatTargetingOverlayProps {
  gridWidth: number;
  gridHeight: number;
  attacker: CombatToken;
  attack: DerivedAttack;
  state: CombatState;
  validCells: Array<{ x: number; y: number }>;
  rangedCellZones?: Map<string, RangedAttackCellZone>;
  hoveredCell: { x: number; y: number } | null;
  previewCenter: { x: number; y: number } | null;
  onPointerMove: (clientX: number, clientY: number) => void;
  onPointerLeave: () => void;
  onCellHover: (cell: { x: number; y: number } | null) => void;
}

export function CombatTargetingOverlay({
  gridWidth,
  gridHeight,
  attacker,
  attack,
  state,
  validCells,
  rangedCellZones,
  hoveredCell,
  previewCenter,
  onPointerMove,
  onPointerLeave,
  onCellHover,
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
  const showRangedGrid = rangedCellZones != null;

  const rangedGridCells = useMemo(() => {
    if (!showRangedGrid || !rangedCellZones) return [];
    const list: Array<{ x: number; y: number; zone: RangedAttackCellZone }> = [];
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const zone = rangedCellZones.get(`${x},${y}`);
        if (zone) list.push({ x, y, zone });
      }
    }
    return list;
  }, [gridHeight, gridWidth, rangedCellZones, showRangedGrid]);

  function handleOverlayPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    onPointerMove(event.clientX, event.clientY);

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
      {showRangedGrid
        ? rangedGridCells.map((cell) => {
            const key = `${cell.x},${cell.y}`;
            const isTarget = validCellSet.has(key);
            const hovered =
              hoveredCell?.x === cell.x && hoveredCell?.y === cell.y;
            return (
              <div
                key={key}
                className={`combat-targeting-cell${
                  isTarget
                    ? " combat-targeting-cell-target"
                    : ` combat-targeting-cell-${cell.zone}`
                }${hovered ? " combat-targeting-cell-hovered" : ""}`}
                style={{ gridColumn: cell.x + 1, gridRow: cell.y + 1 }}
                aria-hidden
              />
            );
          })
        : Array.from({ length: gridHeight }).flatMap((_, y) =>
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
                  }${isValidCell ? " combat-targeting-cell-target" : ""}`}
                  style={{ gridColumn: x + 1, gridRow: y + 1 }}
                  aria-hidden
                />
              );
            })
          )}
    </div>
  );
}
