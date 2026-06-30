"use client";

import type { CombatToken } from "@/lib/schemas/combat-state";

interface CombatObjectInteractionOverlayProps {
  pickupMarkers: CombatToken[];
}

export function CombatObjectInteractionOverlay({
  pickupMarkers,
}: CombatObjectInteractionOverlayProps) {
  const highlightedCells: Array<{ x: number; y: number; key: string }> = [];

  for (const marker of pickupMarkers) {
    for (let dy = 0; dy < marker.height; dy++) {
      for (let dx = 0; dx < marker.width; dx++) {
        const x = marker.x + dx;
        const y = marker.y + dy;
        highlightedCells.push({ x, y, key: `${marker.id}:${x},${y}` });
      }
    }
  }

  return (
    <div className="combat-object-interaction-overlay" aria-hidden>
      {highlightedCells.map((cell) => (
        <div
          key={cell.key}
          className="combat-object-interaction-cell"
          style={{
            gridColumn: `${cell.x + 1}`,
            gridRow: `${cell.y + 1}`,
          }}
        />
      ))}
    </div>
  );
}
