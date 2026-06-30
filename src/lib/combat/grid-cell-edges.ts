import type { CSSProperties } from "react";

export const GRID_CELL_BORDER_WIDTH_PX = 2;

export function gridCellKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** Inset box-shadow on outer edges only so shared borders stay single-width. */
export function getGridCellInsetEdgeShadow(
  x: number,
  y: number,
  groupKeys: ReadonlySet<string>,
  color: string,
  widthPx = GRID_CELL_BORDER_WIDTH_PX
): string | undefined {
  const shadows: string[] = [];

  if (!groupKeys.has(gridCellKey(x, y - 1))) {
    shadows.push(`inset 0 ${widthPx}px 0 0 ${color}`);
  }
  if (!groupKeys.has(gridCellKey(x, y + 1))) {
    shadows.push(`inset 0 -${widthPx}px 0 0 ${color}`);
  }
  if (!groupKeys.has(gridCellKey(x - 1, y))) {
    shadows.push(`inset ${widthPx}px 0 0 0 ${color}`);
  }
  if (!groupKeys.has(gridCellKey(x + 1, y))) {
    shadows.push(`inset -${widthPx}px 0 0 0 ${color}`);
  }

  return shadows.length > 0 ? shadows.join(", ") : undefined;
}

export function buildGridCellGroupMap(
  cells: ReadonlyArray<{ x: number; y: number; groupKey: string }>
): Map<string, Set<string>> {
  const groups = new Map<string, Set<string>>();
  for (const { x, y, groupKey } of cells) {
    let keys = groups.get(groupKey);
    if (!keys) {
      keys = new Set();
      groups.set(groupKey, keys);
    }
    keys.add(gridCellKey(x, y));
  }
  return groups;
}

export function gridCellBorderStyle(
  x: number,
  y: number,
  groupKey: string,
  groupMap: ReadonlyMap<string, Set<string>>,
  color: string,
  widthPx = GRID_CELL_BORDER_WIDTH_PX
): Pick<CSSProperties, "boxShadow"> {
  const groupKeys = groupMap.get(groupKey) ?? new Set<string>();
  const shadow = getGridCellInsetEdgeShadow(x, y, groupKeys, color, widthPx);
  return shadow ? { boxShadow: shadow } : {};
}

export const COMBAT_GRID_BORDER_COLORS = {
  targetingNormal: "rgba(34, 211, 238, 0.95)",
  targetingLong: "rgba(250, 204, 21, 0.95)",
  targetingTarget: "rgba(239, 68, 68, 0.95)",
  targetingAoe: "rgba(251, 146, 60, 0.9)",
  movementNormal: "rgba(34, 211, 238, 0.95)",
  movementDash: "rgba(250, 204, 21, 0.95)",
  measureStart: "rgba(59, 130, 246, 0.95)",
  measureEnd: "rgba(251, 146, 60, 0.95)",
  measurePath: "rgba(148, 163, 184, 0.75)",
  objectPickup: "rgba(45, 212, 191, 0.95)",
  objectSelf: "rgba(250, 204, 21, 0.95)",
} as const;
