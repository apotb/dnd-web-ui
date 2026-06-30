"use client";

import { useMemo } from "react";
import {
  buildGridCellGroupMap,
  COMBAT_GRID_BORDER_COLORS,
  gridCellBorderStyle,
} from "@/lib/combat/grid-cell-edges";
import type { CombatToken } from "@/lib/schemas/combat-state";

interface CombatObjectInteractionOverlayProps {
  pickupMarkers: CombatToken[];
  selfToken?: CombatToken | null;
}

function collectTokenCells(
  token: CombatToken,
  className: string,
  groupKey: string
): Array<{ x: number; y: number; key: string; className: string; groupKey: string }> {
  const cells: Array<{
    x: number;
    y: number;
    key: string;
    className: string;
    groupKey: string;
  }> = [];
  for (let dy = 0; dy < token.height; dy++) {
    for (let dx = 0; dx < token.width; dx++) {
      const x = token.x + dx;
      const y = token.y + dy;
      cells.push({ x, y, key: `${token.id}:${x},${y}`, className, groupKey });
    }
  }
  return cells;
}

export function CombatObjectInteractionOverlay({
  pickupMarkers,
  selfToken = null,
}: CombatObjectInteractionOverlayProps) {
  const highlightedCells = useMemo(
    () => [
      ...(selfToken
        ? collectTokenCells(
            selfToken,
            "combat-object-interaction-cell-self",
            "self"
          )
        : []),
      ...pickupMarkers.flatMap((marker) =>
        collectTokenCells(marker, "combat-object-interaction-cell", "pickup")
      ),
    ],
    [pickupMarkers, selfToken]
  );

  const borderGroups = useMemo(
    () => buildGridCellGroupMap(highlightedCells),
    [highlightedCells]
  );

  return (
    <div className="combat-object-interaction-overlay" aria-hidden>
      {highlightedCells.map((cell) => (
        <div
          key={cell.key}
          className={cell.className}
          style={{
            gridColumn: `${cell.x + 1}`,
            gridRow: `${cell.y + 1}`,
            ...gridCellBorderStyle(
              cell.x,
              cell.y,
              cell.groupKey,
              borderGroups,
              cell.groupKey === "self"
                ? COMBAT_GRID_BORDER_COLORS.objectSelf
                : COMBAT_GRID_BORDER_COLORS.objectPickup
            ),
          }}
        />
      ))}
    </div>
  );
}
