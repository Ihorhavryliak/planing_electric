import { describe, expect, it } from 'vitest';
import {
  distanceBetween,
  formatMeters,
  formatScale,
  geometryIntersectsBounds,
  isClick,
  pointInBounds,
  previewMetersPerUnit,
  screenToWorld,
  visibleWorldBounds,
  worldToScreen,
} from './editor-geometry';

const size = { width: 800, height: 600 };

describe('editor coordinate transforms', () => {
  it('maps the canvas centre to the viewport centre', () => {
    const viewport = { x: 120, y: -40, zoom: 2 };
    expect(screenToWorld({ x: 400, y: 300 }, viewport, size)).toEqual({ x: 120, y: -40 });
  });

  it('round-trips world -> screen -> world at any zoom and pan', () => {
    for (const zoom of [0.02, 0.5, 1, 3.7, 8]) {
      const viewport = { x: 333.3, y: -1200.5, zoom };
      const world = { x: -250.25, y: 987.125 };
      const back = screenToWorld(worldToScreen(world, viewport, size), viewport, size);
      expect(back.x).toBeCloseTo(world.x, 9);
      expect(back.y).toBeCloseTo(world.y, 9);
    }
  });

  it('keeps world distances independent of zoom and pan', () => {
    const a = { x: 100, y: 100 };
    const b = { x: 400, y: 500 };
    for (const viewport of [
      { x: 0, y: 0, zoom: 1 },
      { x: 999, y: -5, zoom: 4 },
    ]) {
      const sa = worldToScreen(a, viewport, size);
      const sb = worldToScreen(b, viewport, size);
      expect(distanceBetween(screenToWorld(sa, viewport, size), screenToWorld(sb, viewport, size))).toBeCloseTo(500, 9);
    }
  });

  it('distinguishes clicks from drags', () => {
    expect(isClick({ x: 10, y: 10 }, { x: 12, y: 11 })).toBe(true);
    expect(isClick({ x: 10, y: 10 }, { x: 20, y: 10 })).toBe(false);
  });
});

describe('length formatting', () => {
  it('formats meters and centimeters', () => {
    expect(formatMeters(12.345)).toBe('12.35 m');
    expect(formatMeters(0.456)).toBe('46 cm');
    expect(formatMeters(Number.NaN)).toBe('—');
  });

  it('formats the scale', () => {
    expect(formatScale(0.005)).toBe('1 unit = 5.00 mm');
    expect(formatScale(2)).toBe('1 unit = 2.00 m');
    expect(formatScale(0)).toBe('—');
    expect(formatMeters(12.345, 'ua')).toBe('12,35 м');
    expect(formatMeters(0.456, 'ua')).toBe('46 см');
    expect(formatScale(0.005, 'ua')).toBe('1 од. = 5,00 мм');
  });
});

describe('calibration preview', () => {
  it('matches the server formula', () => {
    expect(previewMetersPerUnit({ x: 0, y: 0 }, { x: 300, y: 400 }, 2.5, 'm')).toBeCloseTo(0.005, 12);
    expect(previewMetersPerUnit({ x: 0, y: 0 }, { x: 100, y: 0 }, 250, 'cm')).toBeCloseTo(0.025, 12);
  });

  it('returns null for invalid input', () => {
    expect(previewMetersPerUnit({ x: 1, y: 1 }, { x: 1, y: 1 }, 2, 'm')).toBeNull();
    expect(previewMetersPerUnit({ x: 0, y: 0 }, { x: 1, y: 0 }, 0, 'm')).toBeNull();
    expect(previewMetersPerUnit({ x: 0, y: 0 }, { x: 1, y: 0 }, Number.NaN, 'm')).toBeNull();
  });
});

describe('viewport culling', () => {
  const viewport = { x: 100, y: 100, zoom: 1 };

  it('computes visible world bounds including the margin', () => {
    const bounds = visibleWorldBounds(viewport, size, 0);
    expect(bounds.minX).toBe(100 - 400);
    expect(bounds.maxX).toBe(100 + 400);
    expect(bounds.minY).toBe(100 - 300);
    expect(bounds.maxY).toBe(100 + 300);
  });

  it('tests points and geometry against bounds', () => {
    const bounds = visibleWorldBounds(viewport, size, 0);
    expect(pointInBounds({ x: 100, y: 100 }, bounds)).toBe(true);
    expect(pointInBounds({ x: 10_000, y: 100 }, bounds)).toBe(false);
    expect(geometryIntersectsBounds([{ x: -500, y: 0 }, { x: 0, y: 0 }], bounds)).toBe(true);
    expect(geometryIntersectsBounds([{ x: 5000, y: 5000 }, { x: 6000, y: 6000 }], bounds)).toBe(false);
  });
});
