"use client";

import { useMemo } from "react";
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
  onCellClick: (cellX: number, cellY: number) => void;
  onCellHover: (cell: { x: number; y: number } | null) => void;
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
  onCellClick,
  onCellHover,
}: CombatMovementOverlayProps) {
  const cellZones = useMemo(
    () => buildMovementCellZones(destinations, token),
    [destinations, token]
  );

  const hoverDestination = hoveredCell
    ? findDestinationAtCell(destinations, token, hoveredCell.x, hoveredCell.y)
    : null;

  const cells = useMemo(() => {
    const list: Array<{ x: number; y: number; zone: "normal" | "dash" | null }> = [];
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        list.push({ x, y, zone: cellZones.get(`${x},${y}`) ?? null });
      }
    }
    return list;
  }, [cellZones, gridHeight, gridWidth]);

  return (
    <div
      className="combat-movement-overlay"
      style={{
        ["--grid-width" as string]: gridWidth,
        ["--grid-height" as string]: gridHeight,
      }}
      onMouseLeave={() => onCellHover(null)}
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
            onMouseEnter={() => onCellHover({ x: cell.x, y: cell.y })}
            onClick={() => onCellClick(cell.x, cell.y)}
          />
        ) : null
      )}
      {hoverDestination ? (
        <div className="combat-movement-hover-readout" aria-live="polite">
          {hoverDestination.costFeet} ft ·{" "}
          {Math.max(
            0,
            (hoverDestination.zone === "dash" && !dashUsed
              ? speedFeet * 2 - usedFeet
              : remainingFeet) - hoverDestination.costFeet
          )}{" "}
          ft left
          {hoverDestination.zone === "dash" && !dashUsed ? " · Dash required" : ""}
        </div>
      ) : null}
    </div>
  );
}
