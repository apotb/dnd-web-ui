"use client";

import { useMemo } from "react";
import {
  buildGridCellGroupMap,
  COMBAT_GRID_BORDER_COLORS,
  gridCellBorderStyle,
} from "@/lib/combat/grid-cell-edges";
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
    const list: Array<{
      x: number;
      y: number;
      zone: RangedAttackCellZone;
      groupKey: string;
    }> = [];
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const zone = rangedCellZones.get(`${x},${y}`);
        if (!zone) continue;
        const isTarget = validCellSet.has(`${x},${y}`);
        list.push({
          x,
          y,
          zone,
          groupKey: isTarget ? "target" : zone,
        });
      }
    }
    return list;
  }, [gridHeight, gridWidth, rangedCellZones, showRangedGrid, validCellSet]);

  const rangedBorderGroups = useMemo(
    () => buildGridCellGroupMap(rangedGridCells),
    [rangedGridCells]
  );

  const sparseHighlightCells = useMemo(() => {
    if (showRangedGrid) return [];
    const list: Array<{ x: number; y: number; groupKey: string }> = [];
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const key = `${x},${y}`;
        const isValidCell = validCellSet.has(key);
        const isAoeHighlight = highlightCells.has(key);
        if (!isValidCell && !isAoeHighlight) continue;
        list.push({
          x,
          y,
          groupKey: isValidCell ? "target" : "aoe",
        });
      }
    }
    return list;
  }, [gridHeight, gridWidth, highlightCells, showRangedGrid, validCellSet]);

  const sparseBorderGroups = useMemo(
    () => buildGridCellGroupMap(sparseHighlightCells),
    [sparseHighlightCells]
  );

  function targetingBorderColor(groupKey: string): string {
    if (groupKey === "target") return COMBAT_GRID_BORDER_COLORS.targetingTarget;
    if (groupKey === "long") return COMBAT_GRID_BORDER_COLORS.targetingLong;
    if (groupKey === "aoe") return COMBAT_GRID_BORDER_COLORS.targetingAoe;
    return COMBAT_GRID_BORDER_COLORS.targetingNormal;
  }

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
            const isTarget = cell.groupKey === "target";
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
                style={{
                  gridColumn: cell.x + 1,
                  gridRow: cell.y + 1,
                  ...gridCellBorderStyle(
                    cell.x,
                    cell.y,
                    cell.groupKey,
                    rangedBorderGroups,
                    targetingBorderColor(cell.groupKey)
                  ),
                }}
                aria-hidden
              />
            );
          })
        : sparseHighlightCells.map((cell) => {
            const key = `${cell.x},${cell.y}`;
            const isAoeHighlight = cell.groupKey === "aoe";
            const isValidCell = cell.groupKey === "target";
            return (
              <div
                key={key}
                className={`combat-targeting-cell${
                  isAoeHighlight ? " combat-targeting-cell-aoe-preview" : ""
                }${isValidCell ? " combat-targeting-cell-target" : ""}`}
                style={{
                  gridColumn: cell.x + 1,
                  gridRow: cell.y + 1,
                  ...gridCellBorderStyle(
                    cell.x,
                    cell.y,
                    cell.groupKey,
                    sparseBorderGroups,
                    targetingBorderColor(cell.groupKey)
                  ),
                }}
                aria-hidden
              />
            );
          })}
    </div>
  );
}
