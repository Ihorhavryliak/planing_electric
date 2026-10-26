import { describe, expect, it } from 'vitest';
import {
  CalibrationError,
  calculateRoute,
  calibrate,
  distance,
  polylineLength,
  purchaseQuantity,
  totalByMaterial,
  resolveRouteDrops,
  DEFAULT_VERTICAL_DROPS_METERS,
  countRoutePenetrations,
  findPenetrations,
  findRoutePenetrations,
  segmentIntersection,
} from './index';

describe('geometry', () => {
  it('computes a 3-4-5 distance and polyline length', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(
      polylineLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        { x: 3, y: 10 },
      ]),
    ).toBe(11);
  });

  it('returns 0 for empty or single-point polylines', () => {
    expect(polylineLength([])).toBe(0);
    expect(polylineLength([{ x: 1, y: 1 }])).toBe(0);
  });

  it('rejects non-finite coordinates', () => {
    expect(() =>
      polylineLength([
        { x: 0, y: 0 },
        { x: Number.NaN, y: 1 },
      ]),
    ).toThrow(RangeError);
  });
});

describe('calibration', () => {
  it('derives meters per drawing unit', () => {
    const c = calibrate({
      pointA: { x: 0, y: 0 },
      pointB: { x: 300, y: 400 },
      realDistance: 2.5,
    });
    expect(c.drawingDistance).toBe(500);
    expect(c.metersPerUnit).toBeCloseTo(0.005, 12);
  });

  it('converts cm and mm to meters', () => {
    const base = { pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 } };
    expect(calibrate({ ...base, realDistance: 250, unit: 'cm' }).metersPerUnit).toBeCloseTo(0.025, 12);
    expect(calibrate({ ...base, realDistance: 2500, unit: 'mm' }).metersPerUnit).toBeCloseTo(0.025, 12);
  });

  it('is independent of the direction of the points', () => {
    const a = calibrate({ pointA: { x: 0, y: 0 }, pointB: { x: 10, y: 0 }, realDistance: 1 });
    const b = calibrate({ pointA: { x: 10, y: 0 }, pointB: { x: 0, y: 0 }, realDistance: 1 });
    expect(a.metersPerUnit).toBe(b.metersPerUnit);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects real distance %s', (d) => {
    expect(() =>
      calibrate({ pointA: { x: 0, y: 0 }, pointB: { x: 1, y: 0 }, realDistance: d }),
    ).toThrow(CalibrationError);
  });

  it('rejects coincident points', () => {
    expect(() =>
      calibrate({ pointA: { x: 5, y: 5 }, pointB: { x: 5, y: 5 }, realDistance: 1 }),
    ).toThrow(CalibrationError);
  });
});

describe('route calculation', () => {
  const line24 = [
    { x: 0, y: 0 },
    { x: 24, y: 0 },
  ];
  const fourDrops = Array.from({ length: 4 }, () => ({ meters: 1.5 }));

  it('matches the SPEC example: 24 m + 4 x 1.5 m + 10% = 33 m', () => {
    const r = calculateRoute({ points: line24, metersPerUnit: 1, drops: fourDrops });
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.breakdown.planLength).toBe(24);
    expect(r.breakdown.verticalLength).toBe(6);
    expect(r.breakdown.baseLength).toBe(30);
    expect(r.breakdown.wasteLength).toBe(3);
    expect(r.breakdown.requiredLength).toBe(33);
  });

  it('applies scale exactly once', () => {
    // 4800 px at 0.005 m/px = 24 m
    const r = calculateRoute({
      points: [
        { x: 0, y: 0 },
        { x: 4800, y: 0 },
      ],
      metersPerUnit: 0.005,
      drops: fourDrops,
    });
    expect(r.status === 'ok' && r.breakdown.requiredLength).toBe(33);
  });

  it('does not double count drops already in the geometry', () => {
    const r = calculateRoute({
      points: line24,
      metersPerUnit: 1,
      drops: [{ meters: 1.5 }, { meters: 1.5, alreadyInGeometry: true }],
    });
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(r.breakdown.verticalLength).toBe(1.5);
    expect(r.breakdown.skippedVerticalLength).toBe(1.5);
  });

  it('supports a custom or zero waste percentage and defaults to 10', () => {
    const none = calculateRoute({ points: line24, metersPerUnit: 1, wastePercent: 0 });
    const def = calculateRoute({ points: line24, metersPerUnit: 1 });
    expect(none.status === 'ok' && none.breakdown.requiredLength).toBe(24);
    expect(def.status === 'ok' && def.breakdown.wastePercent).toBe(10);
  });

  it('reports uncalibrated plans instead of inventing lengths', () => {
    const r = calculateRoute({ points: line24, metersPerUnit: null });
    expect(r.status).toBe('uncalibrated');
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('warns on routes with fewer than two points', () => {
    const r = calculateRoute({ points: [{ x: 0, y: 0 }], metersPerUnit: 1 });
    expect(r.status === 'ok' && r.warnings).toHaveLength(1);
  });

  it('rejects invalid scale, negative waste and negative drops', () => {
    expect(() => calculateRoute({ points: line24, metersPerUnit: 0 })).toThrow(RangeError);
    expect(() => calculateRoute({ points: line24, metersPerUnit: 1, wastePercent: -5 })).toThrow(RangeError);
    expect(() => calculateRoute({ points: line24, metersPerUnit: 1, drops: [{ meters: -1 }] })).toThrow(RangeError);
  });

  it('has the documented default drops', () => {
    expect(DEFAULT_VERTICAL_DROPS_METERS.socket).toBe(1.5);
    expect(DEFAULT_VERTICAL_DROPS_METERS.light).toBe(2.5);
  });
});

describe('purchase quantities', () => {
  it('does not bump an exact value because of float noise', () => {
    // (24 + 6) * 1.1 === 33.00000000000001 in IEEE-754 doubles
    expect(purchaseQuantity(30 * 1.1, { step: 1 })).toBe(33);
  });

  it('rounds up to whole meters and coils', () => {
    expect(purchaseQuantity(33.2, { step: 1 })).toBe(34);
    expect(purchaseQuantity(101, { step: 100 })).toBe(200);
    expect(purchaseQuantity(0, { step: 100 })).toBe(0);
  });

  it('honours a minimum and rejects bad input', () => {
    expect(purchaseQuantity(3, { step: 1, minimum: 10 })).toBe(10);
    expect(() => purchaseQuantity(-1, { step: 1 })).toThrow(RangeError);
    expect(() => purchaseQuantity(1, { step: 0 })).toThrow(RangeError);
  });

  it('sums per material before rounding', () => {
    const totals = totalByMaterial([
      { materialId: 'a', requiredLength: 33.3 },
      { materialId: 'b', requiredLength: 10 },
      { materialId: 'a', requiredLength: 33.3 },
    ]);
    expect(totals).toEqual([
      { materialId: 'a', requiredLength: 66.6 },
      { materialId: 'b', requiredLength: 10 },
    ]);
    // per-route rounding would give 68; total rounding gives 67
    expect(purchaseQuantity(66.6, { step: 1 })).toBe(67);
  });
});

describe('resolveRouteDrops', () => {
  const points = [
    { id: 'p1', type: 'panel' as const, x: 0, y: 0 },
    { id: 'p2', type: 'socket' as const, x: 10, y: 0, label: 'S1' },
    { id: 'p3', type: 'light' as const, x: 5, y: 0, verticalDropMeters: 3 },
  ];

  it('adds drops only for connected route ends, using defaults and overrides', () => {
    const drops = resolveRouteDrops({
      geometry: [
        { x: 0, y: 0 },
        { x: 5, y: 0 }, // bend lying on a light: must NOT add a drop
        { x: 10, y: 0 },
      ],
      points,
    });
    expect(drops).toEqual([
      { pointId: 'p1', label: 'panel', meters: 0 },
      { pointId: 'p2', label: 'S1', meters: 1.5 },
    ]);
  });

  it('honours per-point overrides and ignores unconnected ends', () => {
    const drops = resolveRouteDrops({
      geometry: [
        { x: 5, y: 0 },
        { x: 50, y: 50 },
      ],
      points,
    });
    expect(drops).toEqual([{ pointId: 'p3', label: 'light', meters: 3 }]);
  });

  it('respects the tolerance and picks the nearest point', () => {
    const near = [
      { id: 'a', type: 'socket' as const, x: 1, y: 0 },
      { id: 'b', type: 'light' as const, x: 0.1, y: 0 },
    ];
    const geometry = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    expect(resolveRouteDrops({ geometry, points: near })).toEqual([]);
    expect(resolveRouteDrops({ geometry, points: near, tolerance: 2 })).toEqual([
      { pointId: 'b', label: 'light', meters: 2.5 },
    ]);
  });

  it('returns nothing for degenerate geometry', () => {
    expect(resolveRouteDrops({ geometry: [{ x: 0, y: 0 }], points })).toEqual([]);
  });
});

describe('wall penetrations', () => {
  const wall = {
    id: 'w1',
    geometry: [
      { x: 10, y: -5 },
      { x: 10, y: 5 },
    ],
  };

  it('intersects crossing segments and rejects parallel ones', () => {
    expect(
      segmentIntersection(
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 10, y: -5 },
        { x: 10, y: 5 },
      ),
    ).toEqual({ x: 10, y: 0 });

    expect(
      segmentIntersection(
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 0, y: 2 },
        { x: 20, y: 2 },
      ),
    ).toBeNull();
  });

  it('counts a crossing once even across a route vertex', () => {
    const result = findRoutePenetrations(
      {
        id: 'r1',
        geometry: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 0 },
        ],
      },
      [wall],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ wallId: 'w1', segmentIndex: 1 });
  });

  it('ignores routes that stay on one side of the wall', () => {
    expect(
      findRoutePenetrations(
        {
          id: 'r1',
          geometry: [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
          ],
        },
        [wall],
      ),
    ).toEqual([]);
  });

  it('aggregates counts per route', () => {
    const secondWall = {
      id: 'w2',
      geometry: [
        { x: 30, y: -5 },
        { x: 30, y: 5 },
      ],
    };
    const routes = [
      {
        id: 'r1',
        geometry: [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
        ],
      },
      {
        id: 'r2',
        geometry: [
          { x: 0, y: 2 },
          { x: 40, y: 2 },
        ],
      },
    ];

    expect(findPenetrations(routes, [wall, secondWall])).toHaveLength(4);
    expect(countRoutePenetrations(routes, [wall, secondWall])).toEqual(
      new Map([
        ['r1', 2],
        ['r2', 2],
      ]),
    );
    expect(countRoutePenetrations([routes[0]!], [wall])).toEqual(
      new Map([['r1', 1]]),
    );
  });
});
