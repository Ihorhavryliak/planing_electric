import type { PlanDrawing } from '@drawmyplace/contracts';
import { describe, expect, it } from 'vitest';
import { calculateElectrical } from '@drawmyplace/calculations';
import { buildPlanSvg } from './svg-export';
import { buildSchematicSvg } from './schematic-export';

const drawing = {
  planId: '00000000-0000-4000-8000-000000000001',
  calibration: {
    planId: '00000000-0000-4000-8000-000000000001',
    pointA: { x: 0, y: 0 },
    pointB: { x: 100, y: 0 },
    realDistance: 1,
    unit: 'm',
    metersPerUnit: 0.01,
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  walls: [
    {
      id: 'w1',
      floorId: '00000000-0000-4000-8000-000000000002',
      geometry: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      thickness: 8,
      label: null,
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  openings: [],
  rooms: [
    {
      id: 'r1',
      floorId: '00000000-0000-4000-8000-000000000002',
      name: 'Kitchen & hall',
      boundary: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  dimensions: [],
  points: [
    {
      id: 'p1',
      floorId: '00000000-0000-4000-8000-000000000002',
      type: 'socket',
      x: 20,
      y: 20,
      rotation: 0,
      label: '<socket>',
      mountingHeight: null,
      properties: { circuitId: 'L1', subtype: 'socket-double' },
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'p2',
      floorId: '00000000-0000-4000-8000-000000000002',
      type: 'light',
      x: 80,
      y: 20,
      rotation: 0,
      label: null,
      mountingHeight: null,
      properties: { circuitId: 'L1' },
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  routes: [
    {
      id: 'rt1',
      floorId: '00000000-0000-4000-8000-000000000002',
      circuitId: 'L1',
      materialId: null,
      geometry: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      settings: { mounting: 'chase', chaseWidthMm: 60 },
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
} as unknown as PlanDrawing;

describe('SVG export', () => {
  it('builds a plan with rooms, points, routes and escaped text', () => {
    const svg = buildPlanSvg(drawing, [{ id: 'L1', color: '#f59e0b' }], {
      title: 'Test plan',
    });

    expect(svg).toContain('<svg');
    expect(svg).toContain('Kitchen &amp; hall');
    expect(svg).toContain('&lt;socket&gt;');
    expect(svg).toContain('#f59e0b');
    expect(svg).toContain('stroke-dasharray');
    expect(svg).toContain('Test plan');
    expect(svg).not.toContain('<script>');
  });

  it('builds a schematic grouped by circuit', () => {
    const svg = buildSchematicSvg(
      drawing,
      { L1: 12.5 },
      { title: 'Schematic', subtitle: 'Floor 1' },
    );

    expect(svg).toContain('L1');
    expect(svg).toContain('12.5 m');
    expect(svg).toContain('Floor 1');
    expect(svg).toContain('2');
  });

  it('includes the intake, breaker tags, wire tags and cable sections', () => {
    const electrical = calculateElectrical({
      circuits: [{ id: 'L1', name: 'Lighting' }],
      devices: [
        { id: 'p1', circuitId: 'L1', type: 'light', subtype: 'light-ceiling' },
      ],
      lengthsByCircuit: { L1: 12.5 },
    });
    const svg = buildSchematicSvg(
      drawing,
      { L1: 12.5 },
      {
        title: 'Schematic',
        circuits: [{ id: 'L1', name: 'Lighting', color: '#f59e0b' }],
        electrical,
      },
    );

    expect(svg).toContain('INCOMING SUPPLY');
    expect(svg).toContain('Main board');
    expect(svg).toContain('Q1-1L1');
    expect(svg).toContain('QF1');
    expect(svg).toContain('W1');
    expect(svg).toContain('X1:1');
    expect(svg).toContain('16 A C');
    expect(svg).toContain('2.5 mm² copper');
  });
});
