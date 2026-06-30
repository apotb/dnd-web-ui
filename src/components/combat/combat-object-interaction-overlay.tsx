"use client";

import type { CombatToken } from "@/lib/schemas/combat-state";

interface CombatObjectInteractionOverlayProps {
  pickupMarkers: CombatToken[];
  selfToken?: CombatToken | null;
}

function collectTokenCells(
  token: CombatToken,
  className: string
): Array<{ x: number; y: number; key: string; className: string }> {
  const cells: Array<{ x: number; y: number; key: string; className: string }> = [];
  for (let dy = 0; dy < token.height; dy++) {
    for (let dx = 0; dx < token.width; dx++) {
      const x = token.x + dx;
      const y = token.y + dy;
      cells.push({ x, y, key: `${token.id}:${x},${y}`, className });
    }
  }
  return cells;
}

export function CombatObjectInteractionOverlay({
  pickupMarkers,
  selfToken = null,
}: CombatObjectInteractionOverlayProps) {
  const highlightedCells = [
    ...(selfToken ? collectTokenCells(selfToken, "combat-object-interaction-cell-self") : []),
    ...pickupMarkers.flatMap((marker) =>
      collectTokenCells(marker, "combat-object-interaction-cell")
    ),
  ];

  return (
    <div className="combat-object-interaction-overlay" aria-hidden>
      {highlightedCells.map((cell) => (
        <div
          key={cell.key}
          className={cell.className}
          style={{
            gridColumn: `${cell.x + 1}`,
            gridRow: `${cell.y + 1}`,
          }}
        />
      ))}
    </div>
  );
}
