"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  buildMovementCellZones,
  findDestinationAtCell,
  type ReachableDestination,
} from "@/lib/combat/movement";
import type { CombatToken } from "@/lib/schemas/combat-state";

interface CombatMovementOverlayProps {
  gridWidth: number;
  gridHeight: number;
  token: CombatToken;
  destinations: ReachableDestination[];
  hoveredCell: { x: number; y: number } | null;
  remainingFeet: number;
  speedFeet: number;
  usedFeet: number;
  dashUsed: boolean;
  actionUsed: boolean;
  onCellClick: (cellX: number, cellY: number) => void;
  onCellHover: (cell: { x: number; y: number } | null) => void;
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

function remainingFeetAfterMove(
  destination: ReachableDestination,
  remainingFeet: number,
  speedFeet: number,
  usedFeet: number,
  dashUsed: boolean,
  actionUsed: boolean
): number {
  const pool =
    destination.zone === "dash" && !dashUsed && !actionUsed
      ? speedFeet * 2 - usedFeet
      : remainingFeet;
  return Math.max(0, pool - destination.costFeet);
}

function dashRequired(
  destination: ReachableDestination,
  dashUsed: boolean,
  actionUsed: boolean
): boolean {
  return destination.zone === "dash" && !dashUsed && !actionUsed;
}

export function CombatMovementOverlay({
  gridWidth,
  gridHeight,
  token,
  destinations,
  hoveredCell,
  remainingFeet,
  speedFeet,
  usedFeet,
  dashUsed,
  actionUsed,
  onCellClick,
  onCellHover,
}: CombatMovementOverlayProps) {
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(
    null
  );
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cellZones = useMemo(
    () => buildMovementCellZones(destinations, token),
    [destinations, token]
  );

  const hoverDestination = hoveredCell
    ? findDestinationAtCell(destinations, token, hoveredCell.x, hoveredCell.y)
    : null;

  const showTooltip = Boolean(hoverDestination && pointer);

  useLayoutEffect(() => {
    if (!showTooltip || !pointer || !tooltipRef.current) {
      setTooltipPosition(null);
      return;
    }

    const rect = tooltipRef.current.getBoundingClientRect();
    setTooltipPosition(clampTooltipPosition(pointer, { width: rect.width, height: rect.height }));
  }, [hoverDestination, pointer, showTooltip, remainingFeet, speedFeet, usedFeet, dashUsed, actionUsed]);

  const cells = useMemo(() => {
    const list: Array<{ x: number; y: number; zone: "normal" | "dash" | null }> = [];
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        list.push({ x, y, zone: cellZones.get(`${x},${y}`) ?? null });
      }
    }
    return list;
  }, [cellZones, gridHeight, gridWidth]);

  function handleOverlayMouseLeave() {
    setPointer(null);
    onCellHover(null);
  }

  function handleCellPointerMove(event: React.MouseEvent<HTMLButtonElement>) {
    setPointer({ x: event.clientX, y: event.clientY });
  }

  const remainingAfterMove = hoverDestination
    ? remainingFeetAfterMove(
        hoverDestination,
        remainingFeet,
        speedFeet,
        usedFeet,
        dashUsed,
        actionUsed
      )
    : 0;

  const needsDash = hoverDestination
    ? dashRequired(hoverDestination, dashUsed, actionUsed)
    : false;

  return (
    <>
      <div
        className="combat-movement-overlay"
        style={{
          ["--grid-width" as string]: gridWidth,
          ["--grid-height" as string]: gridHeight,
        }}
        onMouseLeave={handleOverlayMouseLeave}
      >
        {cells.map((cell) =>
          cell.zone ? (
            <button
              key={`${cell.x},${cell.y}`}
              type="button"
              className={`combat-movement-cell combat-movement-cell-${cell.zone}${
                hoveredCell?.x === cell.x && hoveredCell?.y === cell.y
                  ? " combat-movement-cell-hovered"
                  : ""
              }`}
              style={{
                gridColumn: cell.x + 1,
                gridRow: cell.y + 1,
              }}
              aria-label={`Move to tile ${cell.x + 1}, ${cell.y + 1}`}
              onMouseEnter={(event) => {
                setPointer({ x: event.clientX, y: event.clientY });
                onCellHover({ x: cell.x, y: cell.y });
              }}
              onMouseMove={handleCellPointerMove}
              onClick={() => onCellClick(cell.x, cell.y)}
            />
          ) : null
        )}
      </div>
      {mounted &&
        showTooltip &&
        hoverDestination &&
        pointer &&
        createPortal(
          <div
            ref={tooltipRef}
            className={`combat-movement-cursor-tooltip${
              needsDash ? " combat-movement-cursor-tooltip-dash" : ""
            }`}
            style={{
              left: tooltipPosition?.left ?? pointer.x + OFFSET_X,
              top: tooltipPosition?.top ?? pointer.y + OFFSET_Y,
              visibility: tooltipPosition ? "visible" : "hidden",
            }}
            aria-live="polite"
          >
            <span className="combat-movement-cursor-tooltip-distance">
              {hoverDestination.costFeet} ft
            </span>
            <span>
              {remainingAfterMove} ft left
              {needsDash ? " · Dash required" : ""}
            </span>
          </div>,
          document.body
        )}
    </>
  );
}
