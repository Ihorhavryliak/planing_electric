import { describe, expect, it } from 'vitest';
import type { EditorViewport } from '@drawmyplace/contracts';
import {
  dimensionLine,
  findDimensionAt,
  findPolylineAt,
  findRoomAt,
  findVertexAt,
  offsetFromPointer,
  pointInPolygon,
  polygonArea,
  polygonCentroid,
  polygonPerimeter,
  polylineLength,
  translateGeometry,
} from './structure-geometry';

const viewport: EditorViewport = { x: 0, y: 0, zoom: 1 };
const size = { width: 800, height: 600 };

const square = [
  { x: -50, y: -50 },
  { x: 50, y: -50 },
  { x: 50, y: 50 },
  { x: -50, y: 50 },
];

describe('structure hit testing', () => {
  it('finds the nearest wall polyline in screen space', () => {
    const walls = [
      { id: 'a', geometry: [{ x: 0, y: 0 }, { x: 100, y: 0 }] },
      { id: 'b', geometry: [{ x: 0, y: 100 }, { x: 100, y: 100 }] },
    ];

    // World (50, 4) is 4 px from wall a.
    expect(findPolylineAt(walls, { x: 450, y: 304 }, viewport, size)).toBe('a');
    expect(findPolylineAt(walls, { x: 450, y: 500 }, viewport, size)).toBeNull();
  });

  it('detects points inside and outside a polygon', () => {
    expect(pointInPolygon({ x: 0, y: 0 }, square)).toBe(true);
    expect(pointInPolygon({ x: 49, y: 49 }, square)).toBe(true);
    expect(pointInPolygon({ x: 80, y: 0 }, square)).toBe(false);
  });

  it('selects a room by its interior or an edge', () => {
    const rooms = [{ id: 'room', boundary: square }];
    const center = { x: 400, y: 300 };

    expect(findRoomAt(rooms, center, viewport, size)).toBe('room');
    expect(
      findRoomAt(rooms, { x: 350, y: 300 }, viewport, size),
    ).toBe('room');
    expect(findRoomAt(rooms, { x: 100, y: 100 }, viewport, size)).toBeNull();
  });

  it('finds a vertex index under the pointer', () => {
    expect(findVertexAt(square, { x: 450, y: 250 }, viewport, size)).toBe(1);
    expect(findVertexAt(square, { x: 400, y: 300 }, viewport, size)).toBeNull();
  });
});

describe('structure measurements', () => {
  it('measures open and closed geometry', () => {
    expect(polylineLength(square)).toBe(300);
    expect(polygonPerimeter(square)).toBe(400);
    expect(polygonArea(square)).toBe(10_000);
    expect(polygonCentroid(square)).toEqual({ x: 0, y: 0 });
  });

  it('translates every vertex without mutating the input', () => {
    const moved = translateGeometry(square, 10, -5);

    expect(moved[0]).toEqual({ x: -40, y: -55 });
    expect(square[0]).toEqual({ x: -50, y: -50 });
  });

  it('places a dimension line at a perpendicular offset', () => {
    const line = dimensionLine({ x: 0, y: 0 }, { x: 100, y: 0 }, 20);

    expect(line.length).toBe(100);
    expect(line.normal).toEqual({ x: 0, y: 1 });
    expect(line.start).toEqual({ x: 0, y: 20 });
    expect(line.end).toEqual({ x: 100, y: 20 });
  });

  it('computes an offset from a pointer position', () => {
    expect(offsetFromPointer({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 30 })).toBe(30);
    expect(offsetFromPointer({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: -12 })).toBe(-12);
  });

  it('finds the nearest dimension line', () => {
    const dimensions = [
      {
        id: 'd',
        pointA: { x: 0, y: 0 },
        pointB: { x: 100, y: 0 },
        offset: 40,
      },
    ];

    expect(
      findDimensionAt(dimensions, { x: 450, y: 340 }, viewport, size),
    ).toBe('d');
    expect(
      findDimensionAt(dimensions, { x: 450, y: 300 }, viewport, size),
    ).toBeNull();
  });
});
