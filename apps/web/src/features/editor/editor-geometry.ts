import type { EditorViewport, LengthUnitInput } from '@drawmyplace/contracts';

/**
 * Coordinate model of the editor:
 * - "world" coordinates are what is stored in the database (drawing units);
 * - "screen" coordinates are CSS pixels inside the canvas element.
 * The viewport centre (x, y) is a world point shown in the middle of the canvas.
 * Real-world lengths only appear through a calibration (metersPerUnit).
 */
export interface Vec2 {
  x: number;
  y: number;
}

export interface CanvasSize {
  width: number;
  height: number;
}

export function screenToWorld(
  screen: Vec2,
  viewport: EditorViewport,
  size: CanvasSize,
): Vec2 {
  return {
    x: viewport.x + (screen.x - size.width / 2) / viewport.zoom,
    y: viewport.y + (screen.y - size.height / 2) / viewport.zoom,
  };
}

export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * World-space rectangle currently visible in the canvas, expanded by a margin.
 * Used to skip drawing objects far outside the viewport on large plans.
 */
export function visibleWorldBounds(
  viewport: EditorViewport,
  size: CanvasSize,
  margin = 120,
): WorldBounds {
  const halfWidth = size.width / 2 / viewport.zoom;
  const halfHeight = size.height / 2 / viewport.zoom;
  const marginWorld = margin / viewport.zoom;

  return {
    minX: viewport.x - halfWidth - marginWorld,
    minY: viewport.y - halfHeight - marginWorld,
    maxX: viewport.x + halfWidth + marginWorld,
    maxY: viewport.y + halfHeight + marginWorld,
  };
}

export function pointInBounds(point: Vec2, bounds: WorldBounds): boolean {
  return (
    point.x >= bounds.minX &&
    point.x <= bounds.maxX &&
    point.y >= bounds.minY &&
    point.y <= bounds.maxY
  );
}

export function geometryIntersectsBounds(
  geometry: readonly Vec2[],
  bounds: WorldBounds,
): boolean {
  if (geometry.length === 0) return false;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of geometry) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }
  return (
    maxX >= bounds.minX &&
    minX <= bounds.maxX &&
    maxY >= bounds.minY &&
    minY <= bounds.maxY
  );
}

export function worldToScreen(
  world: Vec2,
  viewport: EditorViewport,
  size: CanvasSize,
): Vec2 {
  return {
    x: (world.x - viewport.x) * viewport.zoom + size.width / 2,
    y: (world.y - viewport.y) * viewport.zoom + size.height / 2,
  };
}

export function distanceBetween(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** True when a pointer moved less than `threshold` px, i.e. it was a click, not a drag. */
export function isClick(start: Vec2, end: Vec2, threshold = 4): boolean {
  return distanceBetween(start, end) < threshold;
}

/** Length in meters as a short label: 12.35 m, or 45 cm below one meter. */
export function formatMeters(meters: number): string {
  if (!Number.isFinite(meters)) {
    return '—';
  }

  if (Math.abs(meters) < 1) {
    return `${Math.round(meters * 100)} cm`;
  }

  return `${meters.toFixed(2)} m`;
}

/** Human readable scale: how much real length one drawing unit represents. */
export function formatScale(metersPerUnit: number): string {
  if (!Number.isFinite(metersPerUnit) || metersPerUnit <= 0) {
    return '—';
  }

  if (metersPerUnit >= 1) {
    return `1 unit = ${metersPerUnit.toPrecision(3)} m`;
  }

  return `1 unit = ${(metersPerUnit * 1000).toPrecision(3)} mm`;
}

/**
 * Preview only: the server recomputes the authoritative scale with
 * `@drawmyplace/calculations`. Web imports types from workspace packages, not
 * their runtime code, so the factors are repeated here (typed exhaustively).
 */
export const UNIT_METERS: Record<LengthUnitInput, number> = {
  mm: 0.001,
  cm: 0.01,
  m: 1,
};

/** Meters per drawing unit, or null when the input cannot be a valid calibration. */
export function previewMetersPerUnit(
  a: Vec2,
  b: Vec2,
  realDistance: number,
  unit: LengthUnitInput,
): number | null {
  const drawingDistance = distanceBetween(a, b);

  if (
    !Number.isFinite(realDistance) ||
    realDistance <= 0 ||
    !Number.isFinite(drawingDistance) ||
    drawingDistance <= 0
  ) {
    return null;
  }

  return (realDistance * UNIT_METERS[unit]) / drawingDistance;
}

/** A "nice" 1/2/5 x 10^n step close to `target` (drawing units). */
export function niceStep(target: number): number {
  const power = 10 ** Math.floor(Math.log10(target));
  const normalized = target / power;

  if (normalized <= 1) {
    return power;
  }

  if (normalized <= 2) {
    return 2 * power;
  }

  if (normalized <= 5) {
    return 5 * power;
  }

  return 10 * power;
}

/** Minor grid step in drawing units for a zoom level; matches the drawn grid. */
export function gridStep(zoom: number): number {
  return niceStep(90 / zoom) / 5;
}

export function snapToStep(world: Vec2, step: number): Vec2 {
  if (!Number.isFinite(step) || step <= 0) {
    return world;
  }

  // `|| 0` turns -0 into 0.
  return {
    x: Math.round(world.x / step) * step || 0,
    y: Math.round(world.y / step) * step || 0,
  };
}

export interface HitTarget extends Vec2 {
  id: string;
}

/**
 * Id of the point nearest to a screen position within `radiusPx`, or null.
 * The hit radius is in screen pixels so symbols stay easy to grab at any zoom.
 */
export function findPointAt(
  points: readonly HitTarget[],
  screen: Vec2,
  viewport: EditorViewport,
  size: CanvasSize,
  radiusPx = 12,
): string | null {
  let bestId: string | null = null;
  let bestDistance = radiusPx;

  for (const point of points) {
    const at = worldToScreen(point, viewport, size);
    const gap = distanceBetween(at, screen);

    // `<=` lets a later (drawn on top) point win a tie.
    if (gap <= bestDistance) {
      bestDistance = gap;
      bestId = point.id;
    }
  }

  return bestId;
}
