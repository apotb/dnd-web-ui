"use client";

import { useMemo } from "react";
import {
  blockedCellKey,
  cellsInRectangle,
  type BlockedCell,
} from "@/lib/combat/collision";

interface CombatCollisionOverlayProps {
  gridWidth: number;
  gridHeight: number;
  blockedKeys: Set<string>;
  dragStart?: BlockedCell | null;
  dragEnd?: BlockedCell | null;
  dragRemoving?: boolean;
  translucent?: boolean;
  onPointerDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
}

export function CombatCollisionOverlay({
  gridWidth,
  gridHeight,
  blockedKeys,
  dragStart = null,
  dragEnd = null,
  dragRemoving = false,
  translucent = false,
  onPointerDown,
}: CombatCollisionOverlayProps) {
  const editing = !translucent && onPointerDown != null;

  const previewKeys = useMemo(() => {
    if (!editing || !dragStart || !dragEnd) return new Set<string>();
    return new Set(
      cellsInRectangle(
        dragStart.x,
        dragStart.y,
        dragEnd.x,
        dragEnd.y,
        gridWidth,
        gridHeight
      ).map((cell) => blockedCellKey(cell.x, cell.y))
    );
  }, [dragEnd, dragStart, editing, gridHeight, gridWidth]);

  const blockedCells = useMemo(() => {
    const list: BlockedCell[] = [];
    for (const key of blockedKeys) {
      const [x, y] = key.split(",").map(Number);
      list.push({ x, y });
    }
    return list;
  }, [blockedKeys]);

  const previewCells = useMemo(() => {
    const list: BlockedCell[] = [];
    for (const key of previewKeys) {
      const [x, y] = key.split(",").map(Number);
      list.push({ x, y });
    }
    return list;
  }, [previewKeys]);

  return (
    <div
      className={`combat-collision-overlay${translucent ? " combat-collision-overlay-translucent" : ""}`}
      onPointerDown={onPointerDown}
    >
      <div
        className="combat-collision-visuals"
        aria-hidden
        style={{
          ["--grid-width" as string]: gridWidth,
          ["--grid-height" as string]: gridHeight,
        }}
      >
        {blockedCells.map((cell) => (
          <div
            key={`blocked-${cell.x},${cell.y}`}
            className="combat-collision-cell"
            style={{
              gridColumn: cell.x + 1,
              gridRow: cell.y + 1,
            }}
          />
        ))}
        {previewCells.map((cell) => {
          if (!editing) return null;
          const key = blockedCellKey(cell.x, cell.y);
          const isBlocked = blockedKeys.has(key);
          if (dragRemoving) {
            if (!isBlocked) return null;
            return (
              <div
                key={`preview-${cell.x},${cell.y}`}
                className="combat-collision-cell combat-collision-preview-remove"
                style={{
                  gridColumn: cell.x + 1,
                  gridRow: cell.y + 1,
                }}
              />
            );
          }

          if (isBlocked) return null;
          return (
            <div
              key={`preview-${cell.x},${cell.y}`}
              className="combat-collision-cell combat-collision-preview-add"
              style={{
                gridColumn: cell.x + 1,
                gridRow: cell.y + 1,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
