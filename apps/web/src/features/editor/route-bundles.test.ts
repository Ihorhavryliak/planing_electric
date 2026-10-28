import { describe, expect, it } from 'vitest';
import { computeRouteBundles, offsetPolyline } from './route-bundles';
import {
  DEFAULT_CIRCUIT_COLOR,
  colorToHex,
  effectiveCircuitColors,
  nextCircuitColor,
  paletteColor,
} from './route-colors';

const route = (
  id: string,
  geometry: Array<{ x: number; y: number }>,
  mounting = 'wall',
) => ({ id, geometry, mounting });

describe('route bundles', () => {
  it('groups cables that share a run and offsets them', () => {
    const bundles = computeRouteBundles([
      route('a', [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ]),
      route('b', [
        { x: 10, y: 1 },
        { x: 90, y: 1 },
      ]),
    ]);

    expect(bundles.get('a')).toEqual({ size: 2, index: 0 });
    expect(bundles.get('b')).toEqual({ size: 2, index: 1 });
  });

  it('keeps distant parallel cables separate', () => {
    const bundles = computeRouteBundles([
      route('a', [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ]),
      route('b', [
        { x: 0, y: 40 },
        { x: 100, y: 40 },
      ]),
    ]);

    expect(bundles.get('a')?.size).toBe(1);
    expect(bundles.get('b')?.size).toBe(1);
  });

  it('does not bundle cables on different mounting levels', () => {
    const bundles = computeRouteBundles([
      route('ceiling', [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ], 'ceiling'),
      route('wall', [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ], 'wall'),
    ]);

    expect(bundles.get('ceiling')?.size).toBe(1);
    expect(bundles.get('wall')?.size).toBe(1);
  });

  it('reuses the bundle for three and more cables', () => {
    const bundles = computeRouteBundles([
      route('a', [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ]),
      route('b', [
        { x: 0, y: 0.8 },
        { x: 100, y: 0.8 },
      ]),
      route('c', [
        { x: 0, y: -0.8 },
        { x: 100, y: -0.8 },
      ]),
    ]);

    expect([...bundles.values()].map((bundle) => bundle.size)).toEqual([
      3, 3, 3,
    ]);
    expect([...bundles.values()].map((bundle) => bundle.index)).toEqual([
      0, 1, 2,
    ]);
  });

  it('offsets a polyline sideways', () => {
    const result = offsetPolyline(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      5,
    );

    expect(result).toHaveLength(2);
    expect(result[0]?.y).toBeCloseTo(5);
    expect(result[1]?.y).toBeCloseTo(5);
    expect(result[0]?.x).toBeCloseTo(0);
  });
});

describe('route colours', () => {
  it('gives default circuits distinct palette colours', () => {
    const colors = effectiveCircuitColors([
      { id: 'L1', color: DEFAULT_CIRCUIT_COLOR },
      { id: 'L2', color: DEFAULT_CIRCUIT_COLOR },
      { id: 'L3', color: '#123456' },
    ]);

    expect(colors.get('L1')).toBe(paletteColor(0));
    expect(colors.get('L2')).toBe(paletteColor(1));
    expect(colors.get('L3')).toBe('#123456');
    expect(nextCircuitColor(1)).toBe(paletteColor(1));
  });

  it('avoids palette colours already taken by a custom circuit', () => {
    const colors = effectiveCircuitColors([
      { id: 'custom', color: paletteColor(1) },
      { id: 'default', color: DEFAULT_CIRCUIT_COLOR },
    ]);

    expect(colors.get('custom')).toBe(paletteColor(1));
    expect(colors.get('default')).not.toBe(paletteColor(1));
  });

  it('parses hex colours for the 3D scene', () => {
    expect(colorToHex('#38bdf8')).toBe(0x38bdf8);
    expect(colorToHex('nope')).toBeNull();
    expect(colorToHex(null)).toBeNull();
  });
});
