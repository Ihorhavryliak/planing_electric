import { describe, expect, it } from 'vitest';
import { computeWallBoxes, pointAlongWall } from './three-geometry';

const wall = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
];

describe('3D wall geometry', () => {
  it('finds a point at a distance along a polyline', () => {
    expect(pointAlongWall(wall, 250)).toEqual({ x: 250, y: 0 });
  });

  it('creates one solid box when there are no openings', () => {
    const boxes = computeWallBoxes(wall, [], 250);
    expect(boxes).toEqual([
      { a: { x: 0, y: 0 }, b: { x: 1000, y: 0 }, z0: 0, z1: 250 },
    ]);
  });

  it('leaves a full-height gap for a door', () => {
    const boxes = computeWallBoxes(
      wall,
      [{ offset: 400, width: 400, type: 'door', sillHeight: 0, height: 210 }],
      250,
    );
    expect(boxes.map((box) => [box.a.x, box.b.x])).toEqual([
      [0, 400],
      [800, 1000],
    ]);
  });

  it('adds a sill and a lintel for a window', () => {
    const boxes = computeWallBoxes(
      wall,
      [{ offset: 400, width: 500, type: 'window', sillHeight: 90, height: 130 }],
      250,
    );
    const openingBoxes = boxes.filter(
      (box) => box.a.x >= 400 && box.b.x <= 900,
    );
    expect(openingBoxes).toEqual([
      { a: { x: 400, y: 0 }, b: { x: 900, y: 0 }, z0: 0, z1: 90 },
      { a: { x: 400, y: 0 }, b: { x: 900, y: 0 }, z0: 220, z1: 250 },
    ]);
  });
});
