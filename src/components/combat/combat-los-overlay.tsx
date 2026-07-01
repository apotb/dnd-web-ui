"use client";

import { useMemo } from "react";
import type { VisionDistanceBand } from "@/lib/combat/targeting";

interface CombatLosOverlayProps {
  gridWidth: number;
  gridHeight: number;
  visibleBands: Map<string, VisionDistanceBand>;
}

export function CombatLosOverlay({
  gridWidth,
  gridHeight,
  visibleBands,
}: CombatLosOverlayProps) {
  const hiddenCells = useMemo(() => {
    const list: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        if (!visibleBands.has(`${x},${y}`)) {
          list.push({ x, y });
        }
      }
    }
    return list;
  }, [gridHeight, gridWidth, visibleBands]);

  const bandCells = useMemo(() => {
    const list: Array<{ x: number; y: number; band: VisionDistanceBand }> = [];
    for (const [key, band] of visibleBands) {
      const [x, y] = key.split(",").map(Number);
      list.push({ x, y, band });
    }
    return list;
  }, [visibleBands]);

  return (
    <div
      className="combat-los-overlay"
      style={{
        ["--grid-width" as string]: gridWidth,
        ["--grid-height" as string]: gridHeight,
      }}
      aria-hidden
    >
      <div className="combat-los-layer combat-los-fog-layer">
        {hiddenCells.map((cell) => (
          <div
            key={`hidden-${cell.x},${cell.y}`}
            className="combat-los-cell combat-los-cell-hidden"
            style={{
              gridColumn: cell.x + 1,
              gridRow: cell.y + 1,
            }}
          />
        ))}
      </div>
      <div className="combat-los-layer combat-los-band-layer">
        {bandCells.map((cell) => (
          <div
            key={`band-${cell.x},${cell.y}`}
            className={`combat-los-cell combat-los-cell-${cell.band}`}
            style={{
              gridColumn: cell.x + 1,
              gridRow: cell.y + 1,
            }}
          />
        ))}
      </div>
    </div>
  );
}
