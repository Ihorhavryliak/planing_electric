import { describe, expect, it } from 'vitest';
import { templatePlanPayloadSchema } from '@drawmyplace/contracts';
import { PROJECT_TEMPLATES, templateRows } from './templates';

const EXPECTED = {
  apartment_1br: { walls: 4, rooms: 1, devices: 5, circuits: 2, routes: 4 },
  apartment_2br: { walls: 8, rooms: 3, devices: 10, circuits: 3, routes: 8 },
  house_2fl: { walls: 12, rooms: 4, devices: 15, circuits: 5 },
  office_open: { walls: 6, rooms: 2, devices: 12, circuits: 4, routes: 9 },
} as const;

describe('project template seeds', () => {
  it('ships four valid, calibrated templates', () => {
    expect(PROJECT_TEMPLATES).toHaveLength(4);

    for (const template of PROJECT_TEMPLATES) {
      const payload = templatePlanPayloadSchema.parse(template.planPayload);

      expect(payload.calibration).not.toBeNull();
      expect(payload.calibration?.metersPerUnit).toBeGreaterThan(0);
      expect(payload.walls.length).toBeGreaterThan(0);
      expect(payload.rooms.length).toBeGreaterThan(0);
      expect(payload.points.length).toBeGreaterThan(0);
      expect(payload.calculationSettings?.circuits?.length).toBeGreaterThan(0);
    }
  });

  it('matches the requested room, device and circuit counts', () => {
    for (const template of PROJECT_TEMPLATES) {
      const expected =
        EXPECTED[template.code as keyof typeof EXPECTED];

      expect(expected, template.code).toBeDefined();

      const payload = template.planPayload;

      expect(payload.walls.length, `${template.code} walls`).toBe(
        expected.walls,
      );
      expect(payload.rooms.length, `${template.code} rooms`).toBe(
        expected.rooms,
      );
      expect(payload.points.length, `${template.code} devices`).toBe(
        expected.devices,
      );
      expect(
        payload.calculationSettings?.circuits?.length ?? 0,
        `${template.code} circuits`,
      ).toBe(expected.circuits);

      if ('routes' in expected) {
        expect(payload.routes.length, `${template.code} routes`).toBe(
          expected.routes,
        );
      }
    }
  });

  it('produces unique codes and unique entity ids', () => {
    const codes = new Set(PROJECT_TEMPLATES.map((item) => item.code));
    expect(codes.size).toBe(PROJECT_TEMPLATES.length);

    for (const template of PROJECT_TEMPLATES) {
      const ids = [
        template.planPayload.planId,
        ...template.planPayload.walls.map((item) => item.id),
        ...template.planPayload.rooms.map((item) => item.id),
        ...template.planPayload.points.map((item) => item.id),
        ...template.planPayload.routes.map((item) => item.id),
      ];

      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('can be inserted as database rows', () => {
    const rows = templateRows();

    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.isPublic)).toBe(true);
    expect(rows.map((row) => row.sortOrder)).toEqual([10, 20, 30, 40]);
  });
});
