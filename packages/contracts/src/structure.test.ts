import { describe, expect, it } from 'vitest';
import {
  createDimensionSchema,
  createRoomSchema,
  createWallSchema,
  updateDimensionSchema,
  updateRoomSchema,
  updateWallSchema,
} from './structure';

const line = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
];

describe('wall contracts', () => {
  it('needs at least two vertices and accepts an optional thickness', () => {
    expect(createWallSchema.parse({ geometry: line })).toEqual({
      geometry: line,
    });
    expect(
      createWallSchema.parse({ geometry: line, thickness: 12, label: ' A ' })
        .label,
    ).toBe('A');
    expect(() =>
      createWallSchema.parse({ geometry: [line[0]] }),
    ).toThrow();
    expect(() =>
      createWallSchema.parse({ geometry: line, thickness: -1 }),
    ).toThrow();
  });

  it('requires at least one update field', () => {
    expect(() => updateWallSchema.parse({})).toThrow();
    expect(updateWallSchema.parse({ label: null })).toEqual({ label: null });
  });
});

describe('room contracts', () => {
  const triangle = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ];

  it('needs a name and three boundary points', () => {
    expect(createRoomSchema.parse({ boundary: triangle }).name).toBe('Room');
    expect(() =>
      createRoomSchema.parse({ name: ' ', boundary: triangle }),
    ).toThrow();
    expect(() =>
      createRoomSchema.parse({ name: 'R', boundary: triangle.slice(0, 2) }),
    ).toThrow();
    expect(() => updateRoomSchema.parse({})).toThrow();
    expect(updateRoomSchema.parse({ name: 'Kitchen' })).toEqual({
      name: 'Kitchen',
    });
  });
});

describe('dimension contracts', () => {
  it('defaults the offset and rejects coincident points', () => {
    expect(
      createDimensionSchema.parse({
        pointA: { x: 0, y: 0 },
        pointB: { x: 100, y: 0 },
      }).offset,
    ).toBe(0);
    expect(() =>
      createDimensionSchema.parse({
        pointA: { x: 5, y: 5 },
        pointB: { x: 5, y: 5 },
      }),
    ).toThrow();
  });

  it('rejects a coincident update pair but allows one endpoint', () => {
    expect(() =>
      updateDimensionSchema.parse({
        pointA: { x: 0, y: 0 },
        pointB: { x: 0, y: 0 },
      }),
    ).toThrow();
    expect(
      updateDimensionSchema.parse({ pointA: { x: 5, y: 5 } }),
    ).toEqual({ pointA: { x: 5, y: 5 } });
    expect(() => updateDimensionSchema.parse({})).toThrow();
  });
});
