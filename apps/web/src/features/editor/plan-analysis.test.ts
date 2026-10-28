import { describe, expect, it } from 'vitest';
import { analyzeWallMask } from './plan-analysis';

const UNDERLAY = {
  visible: true,
  locked: false,
  opacity: 1,
  rotation: 0,
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

/**
 * A 1000×750 mask of a four-room flat: double-line outer walls, a vertical
 * partition with a doorway in the lower half and a horizontal partition with a
 * doorway in the left half.
 */
function makeMask(width: number, height: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  const fill = (x1: number, y1: number, x2: number, y2: number) => {
    for (let y = y1; y <= y2; y += 1) {
      for (let x = x1; x <= x2; x += 1) {
        mask[y * width + x] = 1;
      }
    }
  };

  // Outer wall drawn as two 3px lines 9px apart.
  fill(60, 60, 940, 62);
  fill(60, 71, 940, 73);
  fill(60, 677, 940, 679);
  fill(60, 688, 940, 690);
  fill(60, 71, 62, 677);
  fill(71, 71, 73, 677);
  fill(927, 71, 929, 677);
  fill(938, 71, 940, 677);

  // Vertical partition with a 55px doorway in the lower half.
  fill(494, 73, 496, 490);
  fill(505, 73, 507, 490);
  fill(494, 545, 496, 677);
  fill(505, 545, 507, 677);

  // Horizontal partition with a 60px doorway in the left half.
  fill(73, 368, 200, 370);
  fill(73, 379, 200, 381);
  fill(260, 368, 927, 370);
  fill(260, 379, 927, 381);

  return mask;
}

function bounds(points: Array<{ x: number; y: number }>) {
  return {
    x1: Math.min(...points.map((point) => point.x)),
    x2: Math.max(...points.map((point) => point.x)),
    y1: Math.min(...points.map((point) => point.y)),
    y2: Math.max(...points.map((point) => point.y)),
  };
}

describe('plan analysis', () => {
  it('detects four rooms and continuous walls with openings', () => {
    const result = analyzeWallMask(
      makeMask(1000, 750),
      1000,
      750,
      UNDERLAY,
    );

    expect(result.rooms).toHaveLength(4);
    // Four perimeter walls plus two continuous partitions.
    expect(result.walls).toHaveLength(6);
    expect(result.openings).toHaveLength(2);
    expect(result.openings.map((opening) => opening.type)).toEqual([
      'door',
      'door',
    ]);

    result.openings.forEach((opening) => {
      expect(opening.wallIndex).toBeGreaterThanOrEqual(0);
      expect(opening.wallIndex).toBeLessThan(result.walls.length);
      expect(opening.width).toBeGreaterThan(40);
      expect(opening.offset).toBeGreaterThanOrEqual(0);
      expect(opening.height).toBeGreaterThan(0);
    });

    const doorWidths = result.openings
      .map((opening) => opening.width)
      .sort((left, right) => left - right);
    expect(doorWidths[0]).toBeGreaterThan(45);
    expect(doorWidths[1]).toBeLessThan(75);

    const boxes = result.rooms.map((room) => bounds(room.boundary));
    // Rooms must not cover each other; each quadrant is roughly 430×300.
    boxes.forEach((box) => {
      expect(box.x2 - box.x1).toBeGreaterThan(380);
      expect(box.y2 - box.y1).toBeGreaterThan(260);
    });

    const quadrants = boxes.map((box) => {
      const left = (box.x1 + box.x2) / 2 < 0;
      const top = (box.y1 + box.y2) / 2 < 0;

      return `${left ? 'l' : 'r'}${top ? 't' : 'b'}`;
    });
    expect(new Set(quadrants).size).toBe(4);
  });

  it('can leave doorway gaps instead of openings', () => {
    const result = analyzeWallMask(makeMask(1000, 750), 1000, 750, UNDERLAY, {
      detectOpenings: false,
    });

    expect(result.openings).toHaveLength(0);
    expect(result.walls).toHaveLength(8);

    const crossesVerticalDoor = result.walls.some((wall) => {
      const [from, to] = wall.geometry;

      if (!from || !to) return false;
      if (Math.abs(from.x - to.x) > 1) return false;
      if (Math.abs(from.x) > 2) return false;

      return Math.min(from.y, to.y) < 110 && Math.max(from.y, to.y) > 175;
    });
    expect(crossesVerticalDoor).toBe(false);

    const crossesHorizontalDoor = result.walls.some((wall) => {
      const [from, to] = wall.geometry;

      if (!from || !to) return false;
      if (Math.abs(from.y - to.y) > 1) return false;
      if (Math.abs(from.y) > 2) return false;

      return Math.min(from.x, to.x) < -310 && Math.max(from.x, to.x) > -230;
    });
    expect(crossesHorizontalDoor).toBe(false);
  });

  it('keeps the underlay transform in the generated plan', () => {
    const result = analyzeWallMask(makeMask(1000, 750), 1000, 750, {
      ...UNDERLAY,
      scale: 0.5,
      offsetX: 100,
      offsetY: -50,
    });

    const first = result.rooms[0]?.boundary[0];

    expect(first).toBeDefined();
    expect(Math.abs((first?.x ?? 0) - 100)).toBeLessThan(250);
    expect(Math.abs((first?.y ?? 0) + 50)).toBeLessThan(200);
  });
});
