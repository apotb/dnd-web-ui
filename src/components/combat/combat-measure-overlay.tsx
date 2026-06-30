"use client";

import type { GridPosition } from "@/lib/combat/movement";

interface CombatMeasureOverlayProps {
  gridWidth: number;
  gridHeight: number;
  startCell: GridPosition | null;
  hoveredCell: GridPosition | null;
  onCellHover: (cell: GridPosition | null) => void;
  onCellClick: (cell: GridPosition) => void;
}

export function CombatMeasureOverlay({
  gridWidth,
  gridHeight,
  startCell,
  hoveredCell,
  onCellHover,
  onCellClick,
}: CombatMeasureOverlayProps) {
  function handleOverlayPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const overlay = event.currentTarget;
    const rect = overlay.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * gridWidth);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * gridHeight);

    if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) {
      onCellHover(null);
      return;
    }

    onCellHover({ x, y });
  }

  function handleOverlayClick(event: React.MouseEvent<HTMLDivElement>) {
    const overlay = event.currentTarget;
    const rect = overlay.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * gridWidth);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * gridHeight);

    if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) {
      return;
    }

    onCellClick({ x, y });
  }

  const hoverClass = startCell
    ? "combat-measure-cell-hover-end"
    : "combat-measure-cell-hover-start";

  return (
    <div
      className="combat-measure-overlay"
      style={{
        ["--grid-width" as string]: gridWidth,
        ["--grid-height" as string]: gridHeight,
      }}
      onPointerMove={handleOverlayPointerMove}
      onPointerLeave={() => onCellHover(null)}
      onClick={handleOverlayClick}
    >
      {startCell ? (
        <div
          className="combat-measure-cell combat-measure-cell-start"
          style={{ gridColumn: startCell.x + 1, gridRow: startCell.y + 1 }}
          aria-hidden
        />
      ) : null}
      {hoveredCell &&
      (!startCell ||
        hoveredCell.x !== startCell.x ||
        hoveredCell.y !== startCell.y) ? (
        <div
          className={`combat-measure-cell ${hoverClass}`}
          style={{ gridColumn: hoveredCell.x + 1, gridRow: hoveredCell.y + 1 }}
          aria-hidden
        />
      ) : null}
    </div>
  );
}
