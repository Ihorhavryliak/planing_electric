import type { ElectricalPointType } from '@drawmyplace/contracts';

/**
 * Symbol registry for electrical points. Adding a point type means adding one
 * entry here (the record is exhaustive over `ElectricalPointType`), one painter
 * in `point-overlay.ts` and one icon in `editor-canvas.tsx`.
 */
export interface PointSymbol {
  type: ElectricalPointType;
  label: string;
  plural: string;
  /** Single-letter keyboard shortcut that starts the place tool, or null. */
  shortcut: string | null;
  color: string;
}

export const POINT_SYMBOLS: Readonly<Record<ElectricalPointType, PointSymbol>> = {
  socket: { type: 'socket', label: 'Socket', plural: 'sockets', shortcut: 'S', color: '#38bdf8' },
  switch: { type: 'switch', label: 'Switch', plural: 'switches', shortcut: 'W', color: '#a78bfa' },
  light: { type: 'light', label: 'Light', plural: 'lights', shortcut: 'L', color: '#facc15' },
  panel: { type: 'panel', label: 'Distribution board', plural: 'boards', shortcut: 'B', color: '#fb7185' },
  junction: { type: 'junction', label: 'Junction box', plural: 'junction boxes', shortcut: 'J', color: '#34d399' },
  custom: { type: 'custom', label: 'Custom point', plural: 'custom points', shortcut: null, color: '#94a3b8' },
};

/** Registry entries in toolbar order. */
export const POINT_SYMBOL_LIST: readonly PointSymbol[] = [
  POINT_SYMBOLS.socket,
  POINT_SYMBOLS.switch,
  POINT_SYMBOLS.light,
  POINT_SYMBOLS.panel,
  POINT_SYMBOLS.junction,
  POINT_SYMBOLS.custom,
];

/** Symbol for a pressed key (case-insensitive), or null. */
export function symbolForShortcut(key: string): PointSymbol | null {
  const upper = key.toUpperCase();
  return POINT_SYMBOL_LIST.find((symbol) => symbol.shortcut === upper) ?? null;
}

export function countByType(
  points: readonly { type: ElectricalPointType }[],
): Record<ElectricalPointType, number> {
  const counts: Record<ElectricalPointType, number> = {
    socket: 0,
    switch: 0,
    light: 0,
    panel: 0,
    junction: 0,
    custom: 0,
  };

  for (const point of points) {
    counts[point.type] += 1;
  }

  return counts;
}
