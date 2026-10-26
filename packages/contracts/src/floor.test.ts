import { describe, expect, it } from 'vitest';
import {
  createFloorSchema,
  publicPlanSchema,
  underlaySettingsSchema,
  updatePlanSchema,
} from './floor';

describe('floor and plan contracts', () => {
  it('trims floor names and rejects empty ones', () => {
    expect(createFloorSchema.parse({ name: '  Floor 1  ' })).toEqual({
      name: 'Floor 1',
    });
    expect(createFloorSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  it('fills underlay defaults and validates opacity bounds', () => {
    expect(underlaySettingsSchema.parse({})).toEqual({
      visible: true,
      locked: false,
      opacity: 1,
      rotation: 0,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });
    expect(underlaySettingsSchema.safeParse({ opacity: 0 }).success).toBe(false);
    expect(underlaySettingsSchema.safeParse({ opacity: 1.1 }).success).toBe(
      false,
    );
  });

  it('requires at least one plan update field', () => {
    const result = updatePlanSchema.safeParse({});

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Provide at least one field to update',
      );
    }
  });

  it('accepts circuit definitions with a color default', () => {
    const parsed = updatePlanSchema.parse({
      calculationSettings: {
        circuits: [
          { id: 'L1', name: 'Lighting' },
          { id: 'G1', name: 'Sockets', color: '#38bdf8' },
        ],
      },
    });
    expect(parsed.calculationSettings?.circuits).toEqual([
      { id: 'L1', name: 'Lighting', color: '#f59e0b' },
      { id: 'G1', name: 'Sockets', color: '#38bdf8' },
    ]);
    expect(
      updatePlanSchema.safeParse({
        calculationSettings: {
          circuits: [{ id: 'L1', name: 'Lighting', color: 'red' }],
        },
      }).success,
    ).toBe(false);
    expect(
      updatePlanSchema.safeParse({
        calculationSettings: { circuits: [{ id: '', name: 'Lighting' }] },
      }).success,
    ).toBe(false);
  });

  it('accepts page changes and underlay updates', () => {
    expect(updatePlanSchema.parse({ page: 3 })).toEqual({ page: 3 });
    expect(
      updatePlanSchema.parse({
        underlay: { opacity: 0.4, locked: true },
        viewport: { x: 120, y: -50, zoom: 2 },
      }),
    ).toMatchObject({
      underlay: { opacity: 0.4, locked: true, visible: true },
      viewport: { x: 120, y: -50, zoom: 2 },
    });
  });

  it('validates the public plan shape', () => {
    const plan = publicPlanSchema.parse({
      id: '7d03f7d0-8ca7-4f53-9851-c8d3f2bd5f86',
      floorId: 'e4e42d6a-5a3f-4f6f-9f7d-2b2b5a0d6b1a',
      sourceType: 'blank',
      mimeType: null,
      page: null,
      hasFile: false,
      hasPreview: false,
      underlay: {},
      viewport: { x: 0, y: 0, zoom: 1 },
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(plan.underlay.visible).toBe(true);
    expect(plan.viewport.zoom).toBe(1);
  });
});
