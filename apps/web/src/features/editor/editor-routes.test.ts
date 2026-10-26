import { describe, expect, it } from 'vitest';
import { worldToScreen } from './editor-geometry';
import {
  distanceToSegment,
  findRouteAt,
  findRouteSegmentHandleAt,
  attachRouteEnd,
  detachRouteEnd,
  insertVertexAt,
  isDoubleClick,
  moveAttachedRouteEnds,
  moveRouteEndsForPoint,
  removeVertexAt,
  snapToPoint,
} from './route-geometry';

const size = { width: 800, height: 600 };
const viewport = { x: 0, y: 0, zoom: 1 };

describe('distanceToSegment', () => {
  it('measures to the interior and to the clamped ends', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };
    expect(distanceToSegment({ x: 5, y: 3 }, a, b)).toBe(3);
    expect(distanceToSegment({ x: 14, y: 3 }, a, b)).toBe(5);
    expect(distanceToSegment({ x: -3, y: -4 }, a, b)).toBe(5);
  });

  it('handles a zero-length segment', () => {
    expect(distanceToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });
});

describe('findRouteAt', () => {
  const routes = [
    { id: 'a', geometry: [{ x: -100, y: 0 }, { x: 100, y: 0 }] },
    { id: 'b', geometry: [{ x: 0, y: -100 }, { x: 0, y: 100 }] },
  ];

  it('finds a route near any of its segments, at any zoom', () => {
    for (const zoom of [0.5, 1, 4]) {
      const vp = { x: 0, y: 0, zoom };
      const on = worldToScreen({ x: 50 / zoom, y: 0 }, vp, size);
      expect(findRouteAt(routes, { x: on.x, y: on.y + 4 }, vp, size)).toBe('a');
    }
  });

  it('returns null away from every route and prefers the later route at a crossing', () => {
    const far = worldToScreen({ x: 50, y: 50 }, viewport, size);
    expect(findRouteAt(routes, far, viewport, size)).toBeNull();
    const cross = worldToScreen({ x: 0, y: 0 }, viewport, size);
    expect(findRouteAt(routes, cross, viewport, size)).toBe('b');
  });
});

describe('snapToPoint', () => {
  const points = [{ id: 'p', x: 12.3456789, y: -7.1 }];

  it('returns the exact stored coordinates of the point under the cursor', () => {
    const screen = worldToScreen(points[0]!, viewport, size);
    expect(snapToPoint(points, { x: screen.x + 3, y: screen.y - 2 }, viewport, size)).toEqual({
      x: 12.3456789,
      y: -7.1,
    });
  });

  it('returns null when no point is within the radius', () => {
    expect(snapToPoint(points, { x: 0, y: 0 }, viewport, size)).toBeNull();
  });
});

describe('isDoubleClick', () => {
  const first = { x: 100, y: 100, time: 1000 };

  it('needs a previous click close in time and place', () => {
    expect(isDoubleClick(null, first)).toBe(false);
    expect(isDoubleClick(first, { x: 102, y: 101, time: 1200 })).toBe(true);
    expect(isDoubleClick(first, { x: 102, y: 101, time: 1500 })).toBe(false);
    expect(isDoubleClick(first, { x: 140, y: 100, time: 1100 })).toBe(false);
  });
});

describe('moveAttachedRouteEnds', () => {
  it('moves only the route ends sitting on the point', () => {
    const routes = [
      { id: 'attached', geometry: [{ x: 10, y: 20 }, { x: 100, y: 20 }] },
      { id: 'detached', geometry: [{ x: 0, y: 0 }, { x: 10, y: 21 }] },
      { id: 'bend-only', geometry: [{ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 40, y: 0 }] },
    ];

    expect(
      moveAttachedRouteEnds(routes, { x: 10, y: 20 }, { x: 30, y: 40 }),
    ).toEqual([
      {
        id: 'attached',
        geometry: [{ x: 30, y: 40 }, { x: 100, y: 20 }],
      },
    ]);
  });

  it('moves both ends and leaves the input geometry untouched', () => {
    const geometry = [{ x: 10, y: 20 }, { x: 50, y: 50 }, { x: 10, y: 20 }];
    const routes = [{ id: 'closed', geometry }];

    const [update] = moveAttachedRouteEnds(
      routes,
      { x: 10, y: 20 },
      { x: 11, y: 21 },
    );

    expect(update?.geometry).toEqual([
      { x: 11, y: 21 },
      { x: 50, y: 50 },
      { x: 11, y: 21 },
    ]);
    expect(geometry[0]).toEqual({ x: 10, y: 20 });
  });

  it('changes nothing when the point did not move', () => {
    const routes = [{ id: 'r', geometry: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }];
    expect(moveAttachedRouteEnds(routes, { x: 1, y: 2 }, { x: 1, y: 2 })).toEqual(
      [],
    );
  });
});

describe('insertVertexAt', () => {
  const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }];

  it('inserts a bend between two segments without mutating the source', () => {
    const result = insertVertexAt(line, 1, { x: 50, y: 25 });
    expect(result).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 25 },
      { x: 100, y: 0 },
    ]);
    expect(line).toHaveLength(2);
  });

  it('rejects a bend that duplicates a neighbouring vertex or an invalid index', () => {
    expect(insertVertexAt(line, 1, { x: 0, y: 0 })).toBeNull();
    expect(insertVertexAt(line, 1, { x: 100, y: 0 })).toBeNull();
    expect(insertVertexAt(line, -1, { x: 50, y: 0 })).toBeNull();
    expect(insertVertexAt(line, 3, { x: 50, y: 0 })).toBeNull();
    expect(insertVertexAt(line, 0.5, { x: 50, y: 0 })).toBeNull();
  });
});

describe('removeVertexAt', () => {
  const path = [
    { x: 0, y: 0 },
    { x: 50, y: 0 },
    { x: 100, y: 0 },
  ];

  it('removes one bend and returns a copy', () => {
    expect(removeVertexAt(path, 1)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    expect(path).toHaveLength(3);
  });

  it('never removes a vertex when only two would remain', () => {
    expect(removeVertexAt(path.slice(0, 2), 0)).toBeNull();
    expect(removeVertexAt(path, 3)).toBeNull();
  });
});

describe('findRouteSegmentHandleAt', () => {
  const route = { id: 'r', geometry: [{ x: 0, y: 0 }, { x: 100, y: 0 }] };

  it('returns the world midpoint of a segment', () => {
    const midpoint = worldToScreen({ x: 50, y: 0 }, viewport, size);
    expect(
      findRouteSegmentHandleAt(route, { x: midpoint.x + 3, y: midpoint.y }, viewport, size),
    ).toEqual({ segmentIndex: 0, at: { x: 50, y: 0 } });
  });

  it('returns null away from a midpoint and for segments that are too short on screen', () => {
    expect(
      findRouteSegmentHandleAt(route, { x: 10, y: 10 }, viewport, size),
    ).toBeNull();
    expect(
      findRouteSegmentHandleAt(route, { x: 0, y: 0 }, { ...viewport, zoom: 0.1 }, size),
    ).toBeNull();
  });
});

describe('route pins', () => {
  const route = {
    id: 'r',
    startPointId: 'a',
    endPointId: null,
    geometry: [
      { x: 10, y: 20 },
      { x: 50, y: 50 },
      { x: 100, y: 20 },
    ],
  };

  it('attaches an end by snapping it to exact point coordinates', () => {
    expect(attachRouteEnd(route, 'end', { id: 'b', x: 90, y: 10 })).toEqual({
      geometry: [
        { x: 10, y: 20 },
        { x: 50, y: 50 },
        { x: 90, y: 10 },
      ],
      endPointId: 'b',
    });
  });

  it('detaches an end without moving it', () => {
    expect(detachRouteEnd(route, 'start')).toEqual({
      geometry: route.geometry,
      startPointId: null,
    });
  });

  it('moves only explicitly pinned ends for the moved point', () => {
    expect(
      moveRouteEndsForPoint(
        [
          route,
          {
            id: 'legacy',
            geometry: [{ x: 10, y: 20 }, { x: 2, y: 2 }],
          },
          {
            id: 'other-pin',
            startPointId: 'c',
            geometry: [{ x: 10, y: 20 }, { x: 2, y: 2 }],
          },
        ],
        'a',
        { x: 10, y: 20 },
        { x: 11, y: 21 },
      ),
    ).toEqual([
      {
        id: 'r',
        geometry: [
          { x: 11, y: 21 },
          { x: 50, y: 50 },
          { x: 100, y: 20 },
        ],
      },
      {
        id: 'legacy',
        geometry: [
          { x: 11, y: 21 },
          { x: 2, y: 2 },
        ],
      },
    ]);
  });
});
