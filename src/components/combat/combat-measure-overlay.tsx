"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GridPosition } from "@/lib/combat/movement";
import { chebyshevPathCells, distanceFeetBetweenCells } from "@/lib/combat/targeting";

interface CombatMeasureOverlayProps {
  gridWidth: number;
  gridHeight: number;
  tileFeet: number;
  startCell: GridPosition | null;
  hoveredCell: GridPosition | null;
  onCellHover: (cell: GridPosition | null) => void;
  onCellClick: (cell: GridPosition) => void;
}

const VIEWPORT_PADDING = 8;
const OFFSET_X = 14;
const OFFSET_Y = 12;

function clampTooltipPosition(
  anchor: { x: number; y: number },
  size: { width: number; height: number }
): { left: number; top: number } {
  let left = anchor.x + OFFSET_X;
  let top = anchor.y - OFFSET_Y - size.height;

  if (top < VIEWPORT_PADDING) {
    top = anchor.y + OFFSET_Y;
  }

  if (top + size.height > window.innerHeight - VIEWPORT_PADDING) {
    top = Math.max(VIEWPORT_PADDING, window.innerHeight - VIEWPORT_PADDING - size.height);
  }

  if (left + size.width > window.innerWidth - VIEWPORT_PADDING) {
    left = window.innerWidth - VIEWPORT_PADDING - size.width;
  }
  if (left < VIEWPORT_PADDING) {
    left = VIEWPORT_PADDING;
  }

  return { left, top };
}

export function CombatMeasureOverlay({
  gridWidth,
  gridHeight,
  tileFeet,
  startCell,
  hoveredCell,
  onCellHover,
  onCellClick,
}: CombatMeasureOverlayProps) {
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(
    null
  );
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const pathCells = useMemo(() => {
    if (!startCell || !hoveredCell) return [];
    if (startCell.x === hoveredCell.x && startCell.y === hoveredCell.y) return [];
    const path = chebyshevPathCells(startCell, hoveredCell);
    return path.slice(1, -1);
  }, [hoveredCell, startCell]);

  const showEndHover =
    hoveredCell &&
    (!startCell || hoveredCell.x !== startCell.x || hoveredCell.y !== startCell.y);

  const distanceFeet =
    startCell && showEndHover && hoveredCell
      ? distanceFeetBetweenCells(startCell, hoveredCell, tileFeet)
      : null;

  const showTooltip = Boolean(startCell && showEndHover && hoveredCell && pointer && distanceFeet != null);

  useLayoutEffect(() => {
    if (!showTooltip || !pointer || !tooltipRef.current) {
      setTooltipPosition(null);
      return;
    }

    const rect = tooltipRef.current.getBoundingClientRect();
    setTooltipPosition(
      clampTooltipPosition(pointer, { width: rect.width, height: rect.height })
    );
  }, [distanceFeet, hoveredCell, pointer, showTooltip, startCell]);

  function handleOverlayPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    setPointer({ x: event.clientX, y: event.clientY });

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

  function handleOverlayPointerLeave() {
    setPointer(null);
    onCellHover(null);
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
    <>
      <div
        className="combat-measure-overlay"
        style={{
          ["--grid-width" as string]: gridWidth,
          ["--grid-height" as string]: gridHeight,
        }}
        onPointerMove={handleOverlayPointerMove}
        onPointerLeave={handleOverlayPointerLeave}
        onClick={handleOverlayClick}
      >
        {pathCells.map((cell) => (
          <div
            key={`path-${cell.x},${cell.y}`}
            className="combat-measure-cell combat-measure-cell-path"
            style={{ gridColumn: cell.x + 1, gridRow: cell.y + 1 }}
            aria-hidden
          />
        ))}
        {startCell ? (
          <div
            className="combat-measure-cell combat-measure-cell-start"
            style={{ gridColumn: startCell.x + 1, gridRow: startCell.y + 1 }}
            aria-hidden
          />
        ) : null}
        {showEndHover ? (
          <div
            className={`combat-measure-cell ${hoverClass}`}
            style={{ gridColumn: hoveredCell.x + 1, gridRow: hoveredCell.y + 1 }}
            aria-hidden
          />
        ) : null}
      </div>
      {mounted &&
        showTooltip &&
        startCell &&
        hoveredCell &&
        distanceFeet != null &&
        pointer &&
        createPortal(
          <div
            ref={tooltipRef}
            className="combat-measure-cursor-tooltip"
            style={{
              left: tooltipPosition?.left ?? pointer.x + OFFSET_X,
              top: tooltipPosition?.top ?? pointer.y + OFFSET_Y,
              visibility: tooltipPosition ? "visible" : "hidden",
            }}
            aria-live="polite"
          >
            <span>
              From ({startCell.x + 1}, {startCell.y + 1}) to ({hoveredCell.x + 1},{" "}
              {hoveredCell.y + 1})
            </span>
            <span className="combat-measure-cursor-tooltip-distance">{distanceFeet} ft</span>
          </div>,
          document.body
        )}
    </>
  );
}
