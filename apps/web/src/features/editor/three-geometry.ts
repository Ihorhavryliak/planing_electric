import type { Vec2 } from './editor-geometry';

export interface OpeningSpan {
  offset: number;
  width: number;
  type: 'door' | 'window';
  sillHeight: number;
  height: number;
}

export interface WallBox {
  a: Vec2;
  b: Vec2;
  z0: number;
  z1: number;
}

interface Segment {
  start: Vec2;
  end: Vec2;
  startDistance: number;
  length: number;
}

function segments(geometry: readonly Vec2[]): Segment[] {
  const result: Segment[] = [];
  let distance = 0;
  for (let index = 0; index < geometry.length - 1; index += 1) {
    const start = geometry[index];
    const end = geometry[index + 1];
    if (!start || !end) continue;
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    result.push({ start, end, startDistance: distance, length });
    distance += length;
  }
  return result;
}

export function pointAlongWall(
  geometry: readonly Vec2[],
  distance: number,
): Vec2 | null {
  const list = segments(geometry);
  if (list.length === 0) return null;
  const clamped = Math.max(
    0,
    Math.min(distance, list[list.length - 1]!.startDistance + list[list.length - 1]!.length),
  );
  for (const segment of list) {
    if (
      clamped <= segment.startDistance + segment.length ||
      segment === list[list.length - 1]
    ) {
      const t =
        segment.length === 0
          ? 0
          : (clamped - segment.startDistance) / segment.length;
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * t,
        y: segment.start.y + (segment.end.y - segment.start.y) * t,
      };
    }
  }
  return null;
}

/**
 * Splits a polyline wall into solid boxes, leaving door gaps and window
 * openings with a sill block below and a lintel block above.
 */
export function computeWallBoxes(
  geometry: readonly Vec2[],
  openings: readonly OpeningSpan[],
  wallHeight: number,
): WallBox[] {
  const list = segments(geometry);
  const boxes: WallBox[] = [];

  for (const segment of list) {
    if (segment.length <= 0) continue;
    const segmentStart = segment.startDistance;
    const segmentEnd = segmentStart + segment.length;

    const overlaps = openings
      .map((opening) => ({
        opening,
        start: Math.max(opening.offset, segmentStart),
        end: Math.min(opening.offset + opening.width, segmentEnd),
      }))
      .filter((item) => item.end - item.start > 1e-6)
      .sort((a, b) => a.start - b.start);

    let cursor = segmentStart;
    const addSolid = (from: number, to: number, z0: number, z1: number) => {
      if (to - from <= 1e-6 || z1 - z0 <= 1e-6) return;
      const a = pointAlongWall(geometry, from);
      const b = pointAlongWall(geometry, to);
      if (a && b) boxes.push({ a, b, z0, z1 });
    };

    for (const overlap of overlaps) {
      addSolid(cursor, overlap.start, 0, wallHeight);

      if (overlap.opening.type === 'window') {
        const sill = Math.max(
          0,
          Math.min(wallHeight, overlap.opening.sillHeight),
        );
        const top = Math.min(
          wallHeight,
          sill + Math.max(0, overlap.opening.height),
        );
        addSolid(overlap.start, overlap.end, 0, sill);
        addSolid(overlap.start, overlap.end, top, wallHeight);
      }

      cursor = Math.max(cursor, overlap.end);
    }

    addSolid(cursor, segmentEnd, 0, wallHeight);
  }

  return boxes;
}
