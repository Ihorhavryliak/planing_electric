import { describe, expect, it } from 'vitest';
import {
  createPointSchema,
  createRouteSchema,
  pointPropertiesSchema,
  setCalibrationSchema,
  updatePointSchema,
  updateRouteSchema,
} from './drawing';

describe('calibration contract', () => {
  const base = { pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, realDistance: 2 };

  it('defaults the unit to meters', () => {
    expect(setCalibrationSchema.parse(base).unit).toBe('m');
  });

  it.each([0, -3])('rejects real distance %s', (realDistance) => {
    expect(() => setCalibrationSchema.parse({ ...base, realDistance })).toThrow();
  });

  it('rejects coincident points and unknown units', () => {
    expect(() => setCalibrationSchema.parse({ ...base, pointB: base.pointA })).toThrow();
    expect(() => setCalibrationSchema.parse({ ...base, unit: 'ft' })).toThrow();
  });
});

describe('point contracts', () => {
  it('applies defaults and rejects unknown types and properties', () => {
    const point = createPointSchema.parse({ type: 'socket', x: 1, y: 2 });
    expect(point.rotation).toBe(0);
    expect(point.properties).toEqual({});
    expect(() => createPointSchema.parse({ type: 'toaster', x: 1, y: 2 })).toThrow();
    expect(() =>
      createPointSchema.parse({ type: 'socket', x: 1, y: 2, properties: { evil: 1 } }),
    ).toThrow();
  });

  it('rejects non-finite and out-of-range coordinates', () => {
    expect(() => createPointSchema.parse({ type: 'socket', x: Number.NaN, y: 0 })).toThrow();
    expect(() => createPointSchema.parse({ type: 'socket', x: 1e9, y: 0 })).toThrow();
  });

  it('requires at least one field to update', () => {
    expect(() => updatePointSchema.parse({})).toThrow();
    expect(updatePointSchema.parse({ x: 5 })).toEqual({ x: 5 });
  });
});

describe('route contracts', () => {
  const line = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ];

  it('needs two vertices and a bounded waste percentage', () => {
    expect(createRouteSchema.parse({ geometry: line }).settings).toEqual({});
    expect(() => createRouteSchema.parse({ geometry: [line[0]] })).toThrow();
    expect(() => createRouteSchema.parse({ geometry: line, settings: { wastePercent: 101 } })).toThrow();
    expect(() => createRouteSchema.parse({ geometry: line, settings: { wastePercent: -1 } })).toThrow();
    expect(
      createRouteSchema.parse({
        geometry: line,
        settings: {
          mounting: 'chase',
          chaseWidthMm: 60,
          chaseDepthMm: 25,
        },
      }).settings,
    ).toEqual({ mounting: 'chase', chaseWidthMm: 60, chaseDepthMm: 25 });
    expect(() =>
      createRouteSchema.parse({
        geometry: line,
        settings: { mounting: 'trench' },
      }),
    ).toThrow();
    expect(() =>
      createRouteSchema.parse({
        geometry: line,
        settings: { mounting: 'chase', chaseWidthMm: 5 },
      }),
    ).toThrow();
  });

  it('caps the vertex count', () => {
    const many = Array.from({ length: 501 }, (_, i) => ({ x: i, y: 0 }));
    expect(() => createRouteSchema.parse({ geometry: many })).toThrow();
  });

  it('requires at least one field to update', () => {
    expect(() => updateRouteSchema.parse({})).toThrow();
    expect(updateRouteSchema.parse({ circuitId: 'L1' })).toEqual({ circuitId: 'L1' });
  });

  it('accepts explicit point pins on route ends', () => {
    const startPointId = '11111111-1111-4111-8111-111111111111';
    const endPointId = '22222222-2222-4222-8222-222222222222';

    expect(
      createRouteSchema.parse({
        geometry: line,
        startPointId,
        endPointId,
      }),
    ).toMatchObject({ startPointId, endPointId });
    expect(
      updateRouteSchema.parse({ endPointId: null }),
    ).toEqual({ endPointId: null });
    expect(() =>
      createRouteSchema.parse({ geometry: line, startPointId: 'not-a-uuid' }),
    ).toThrow();
  });

  it('accepts circuit assignments on points', () => {
    expect(pointPropertiesSchema.parse({ circuitId: 'L1' })).toEqual({
      circuitId: 'L1',
    });
    expect(pointPropertiesSchema.parse({ circuitId: null })).toEqual({
      circuitId: null,
    });
    expect(() => pointPropertiesSchema.parse({ circuitId: '' })).toThrow();
  });

  it('accepts catalog device subtypes', () => {
    expect(pointPropertiesSchema.parse({ subtype: 'socket-double' })).toEqual({
      subtype: 'socket-double',
    });
    expect(pointPropertiesSchema.parse({ subtype: null })).toEqual({
      subtype: null,
    });
    expect(() =>
      pointPropertiesSchema.parse({ subtype: 'socket-unknown' }),
    ).toThrow();
  });
});
