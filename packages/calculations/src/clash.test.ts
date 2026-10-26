import { describe, expect, it } from 'vitest';
import {
  findClashes,
  findRoutePointClashes,
  findRouteRouteClashes,
  segmentDistance,
} from './clash';

const line = (id: string, circuitId: string | null, points: number[][], mounting?: string) => ({
  id,
  circuitId,
  mounting: mounting ?? 'ceiling',
  geometry: points.map(([x, y]) => ({ x: x!, y: y! })),
});

describe('clash detection', () => {
  it('reports crossing routes from different circuits as errors', () => {
    const clashes = findRouteRouteClashes([
      line('r1', 'C1', [[0, 0], [100, 0]]),
      line('r2', 'C2', [[50, -50], [50, 50]]),
    ]);

    expect(clashes).toHaveLength(1);
    expect(clashes[0]).toMatchObject({
      kind: 'route-route',
      severity: 'error',
      routeId: 'r1',
      otherId: 'r2',
      point: { x: 50, y: 0 },
    });
  });

  it('warns when the same circuit crosses itself', () => {
    const clashes = findRouteRouteClashes([
      line('r1', 'C1', [[0, 0], [100, 0]]),
      line('r2', 'C1', [[50, -50], [50, 50]]),
    ]);

    expect(clashes[0]?.severity).toBe('warning');
  });

  it('ignores routes on different mounting levels', () => {
    const clashes = findRouteRouteClashes([
      line('r1', 'C1', [[0, 0], [100, 0]], 'ceiling'),
      line('r2', 'C2', [[50, -50], [50, 50]], 'floor'),
    ]);

    expect(clashes).toEqual([]);
  });

  it('ignores crossings at shared route endpoints', () => {
    const clashes = findRouteRouteClashes([
      line('r1', 'C1', [[0, 0], [100, 0]]),
      line('r2', 'C2', [[0, 0], [0, 100]]),
    ]);

    expect(clashes).toEqual([]);
  });

  it('detects routes passing through devices of another circuit', () => {
    const route = line('r1', 'C1', [[0, 0], [100, 0]]);
    const clashes = findRoutePointClashes([route], [
      { id: 'p1', type: 'socket', x: 50, y: 0, circuitId: 'C2' },
      { id: 'p2', type: 'socket', x: 50, y: 50, circuitId: 'C2' },
      { id: 'p3', type: 'junction', x: 60, y: 0, circuitId: null },
    ]);

    expect(clashes).toHaveLength(2);
    expect(clashes[0]).toMatchObject({
      kind: 'route-point',
      segmentIndex: 0,
      otherId: 'p1',
      severity: 'error',
    });
    expect(clashes[1]?.severity).toBe('warning');
  });

  it('skips a device served by the route and route endpoints', () => {
    const route = line('r1', 'C1', [[0, 0], [100, 0]]);

    expect(
      findRoutePointClashes([route], [
        { id: 'p1', type: 'socket', x: 100, y: 0, circuitId: 'C1' },
        { id: 'p2', type: 'socket', x: 0, y: 0, circuitId: 'C2' },
      ]),
    ).toEqual([]);
  });

  it('measures the distance between skew segments', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 0 };
    const c = { x: 0, y: 10 };
    const d = { x: 100, y: 10 };

    expect(segmentDistance(a, b, c, d)).toBe(10);
    expect(segmentDistance(a, b, { x: 50, y: -10 }, { x: 50, y: 10 })).toBe(0);
  });

  it('optionally reports parallel runs below the clearance', () => {
    const routes = [
      line('r1', 'C1', [[0, 0], [100, 0]]),
      line('r2', 'C2', [[0, 3], [100, 3]]),
    ];

    expect(findRouteRouteClashes(routes)).toEqual([]);
    const close = findClashes({ routes }, { minSeparation: 5 });
    expect(close).toHaveLength(1);
    expect(close[0]?.kind).toBe('route-route');
  });

  it('combines route-route and route-point clashes with deduplicated ids', () => {
    const routes = [
      line('r1', 'C1', [[0, 0], [100, 0]]),
      line('r2', 'C2', [[0, 50], [100, 50]]),
    ];
    const clashes = findClashes({
      routes,
      points: [{ id: 'p1', type: 'light', x: 25, y: 50, circuitId: 'C1' }],
    });

    expect(clashes).toHaveLength(1);
    expect(new Set(clashes.map((clash) => clash.id)).size).toBe(1);
  });
});
