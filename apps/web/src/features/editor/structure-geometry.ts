import type { EditorViewport } from '@drawmyplace/contracts';
import {
  distanceBetween,
  findPointAt,
  worldToScreen,
  type CanvasSize,
  type Vec2,
} from './editor-geometry';
import { distanceToSegment } from './route-geometry';

export interface PolylineTarget {
  id: string;
  geometry: readonly Vec2[];
}

export interface PolygonTarget {
  id: string;
  boundary: readonly Vec2[];
}

export interface DimensionTarget {
  id: string;
  pointA: Vec2;
  pointB: Vec2;
  offset: number;
}

/** True when `point` lies inside the polygon (even-odd rule). */
export function pointInPolygon(point: Vec2, polygon: readonly Vec2[]): boolean {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];

    if (!a || !b) {
      continue;
    }

    const crosses =
      a.y > point.y !== b.y > point.y &&
      point.x <
        ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || Number.EPSILON) +
          a.x;

    if (crosses) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Id of the polyline nearest to a screen position, within `radiusPx`. Later
 * objects win ties, matching the draw order (the topmost one is selected).
 */
export function findPolylineAt(
  targets: readonly PolylineTarget[],
  screen: Vec2,
  viewport: EditorViewport,
  size: CanvasSize,
  radiusPx = 8,
): string | null {
  let bestId: string | null = null;
  let bestDistance = radiusPx;

  for (const target of targets) {
    const path = target.geometry.map((vertex) =>
      worldToScreen(vertex, viewport, size),
    );

    for (let i = 1; i < path.length; i += 1) {
      const a = path[i - 1];
      const b = path[i];

      if (!a || !b) {
        continue;
      }

      const gap = distanceToSegment(screen, a, b);

      if (gap <= bestDistance) {
        bestDistance = gap;
        bestId = target.id;
      }
    }
  }

  return bestId;
}

/**
 * Id of the room under a screen position: either inside its boundary or on an
 * edge within `radiusPx`. Later rooms win ties.
 */
export function findRoomAt(
  rooms: readonly PolygonTarget[],
  screen: Vec2,
  viewport: EditorViewport,
  size: CanvasSize,
  radiusPx = 8,
): string | null {
  let bestId: string | null = null;
  const world = {
    x: viewport.x + (screen.x - size.width / 2) / viewport.zoom,
    y: viewport.y + (screen.y - size.height / 2) / viewport.zoom,
  };

  for (const room of rooms) {
    const onEdge =
      findPolylineAt(
        [{ id: room.id, geometry: room.boundary }],
        screen,
        viewport,
        size,
        radiusPx,
      ) !== null;

    if (onEdge || pointInPolygon(world, room.boundary)) {
      bestId = room.id;
    }
  }

  return bestId;
}

/** Index of a vertex under a screen position, or null. */
export function findVertexAt(
  geometry: readonly Vec2[],
  screen: Vec2,
  viewport: EditorViewport,
  size: CanvasSize,
  radiusPx = 10,
): number | null {
  const id = findPointAt(
    geometry.map((vertex, index) => ({ ...vertex, id: String(index) })),
    screen,
    viewport,
    size,
    radiusPx,
  );

  return id === null ? null : Number(id);
}

export function translateGeometry(
  geometry: readonly Vec2[],
  dx: number,
  dy: number,
): Vec2[] {
  return geometry.map((vertex) => ({ x: vertex.x + dx, y: vertex.y + dy }));
}

export function polylineLength(geometry: readonly Vec2[]): number {
  let total = 0;

  for (let i = 1; i < geometry.length; i += 1) {
    const a = geometry[i - 1];
    const b = geometry[i];

    if (a && b) {
      total += distanceBetween(a, b);
    }
  }

  return total;
}

/** Closed boundary length in drawing units. */
export function polygonPerimeter(boundary: readonly Vec2[]): number {
  if (boundary.length < 2) {
    return 0;
  }

  const first = boundary[0];

  return first ? polylineLength([...boundary, first]) : 0;
}

/** Absolute polygon area in square drawing units. */
export function polygonArea(boundary: readonly Vec2[]): number {
  let sum = 0;

  for (let i = 0; i < boundary.length; i += 1) {
    const a = boundary[i];
    const b = boundary[(i + 1) % boundary.length];

    if (a && b) {
      sum += a.x * b.y - b.x * a.y;
    }
  }

  return Math.abs(sum) / 2;
}

/** Centroid of a polygon; falls back to the average vertex when area is zero. */
export function polygonCentroid(boundary: readonly Vec2[]): Vec2 {
  let areaSum = 0;
  let x = 0;
  let y = 0;

  for (let i = 0; i < boundary.length; i += 1) {
    const a = boundary[i];
    const b = boundary[(i + 1) % boundary.length];

    if (!a || !b) {
      continue;
    }

    const cross = a.x * b.y - b.x * a.y;
    areaSum += cross;
    x += (a.x + b.x) * cross;
    y += (a.y + b.y) * cross;
  }

  if (Math.abs(areaSum) > Number.EPSILON) {
    return { x: x / (3 * areaSum), y: y / (3 * areaSum) };
  }

  const count = Math.max(1, boundary.length);

  return {
    x: boundary.reduce((sum, vertex) => sum + vertex.x, 0) / count,
    y: boundary.reduce((sum, vertex) => sum + vertex.y, 0) / count,
  };
}

export interface DimensionLine {
  start: Vec2;
  end: Vec2;
  /** Unit normal pointing from the measured baseline towards the dimension line. */
  normal: Vec2;
  length: number;
}

/** Dimension line endpoints, offset perpendicular to the measured points. */
export function dimensionLine(
  pointA: Vec2,
  pointB: Vec2,
  offset: number,
): DimensionLine {
  const length = distanceBetween(pointA, pointB);
  const normal =
    length > 0
      ? {
          x: -(pointB.y - pointA.y) / length || 0,
          y: (pointB.x - pointA.x) / length || 0,
        }
      : { x: 0, y: 0 };

  return {
    start: { x: pointA.x + normal.x * offset, y: pointA.y + normal.y * offset },
    end: { x: pointB.x + normal.x * offset, y: pointB.y + normal.y * offset },
    normal,
    length,
  };
}

/** Offset that puts the dimension line under the pointer, for drag editing. */
export function offsetFromPointer(
  pointA: Vec2,
  pointB: Vec2,
  pointer: Vec2,
): number {
  const length = distanceBetween(pointA, pointB);

  if (length === 0) {
    return 0;
  }

  const normal = {
    x: -(pointB.y - pointA.y) / length || 0,
    y: (pointB.x - pointA.x) / length || 0,
  };

  return (pointer.x - pointA.x) * normal.x + (pointer.y - pointA.y) * normal.y;
}

/** Id of the dimension line nearest to a screen position, or null. */
export function findDimensionAt(
  dimensions: readonly DimensionTarget[],
  screen: Vec2,
  viewport: EditorViewport,
  size: CanvasSize,
  radiusPx = 8,
): string | null {
  let bestId: string | null = null;
  let bestDistance = radiusPx;

  for (const dimension of dimensions) {
    const line = dimensionLine(
      dimension.pointA,
      dimension.pointB,
      dimension.offset,
    );
    const a = worldToScreen(line.start, viewport, size);
    const b = worldToScreen(line.end, viewport, size);
    const gap = distanceToSegment(screen, a, b);

    if (gap <= bestDistance) {
      bestDistance = gap;
      bestId = dimension.id;
    }
  }

  return bestId;
}
