import { describe, expect, it } from 'vitest';
import { createDemoLocalProject } from './demo-project';

describe('demo project', () => {
  const project = createDemoLocalProject('Demo', {
    livingRoom: 'Living room',
    kitchen: 'Kitchen',
    bedroom: 'Bedroom',
    bathroom: 'Bathroom',
  });

  it('contains a complete calibrated apartment plan', () => {
    const { drawing } = project;

    expect(drawing.calibration?.metersPerUnit).toBe(0.01);
    expect(drawing.circuits).toHaveLength(5);
    expect(drawing.walls).toHaveLength(6);
    expect(drawing.rooms).toHaveLength(4);
    expect(drawing.openings).toHaveLength(5);
    expect(drawing.dimensions).toHaveLength(2);
    expect(drawing.points.length).toBeGreaterThan(10);
    expect(drawing.routes.length).toBeGreaterThan(10);
    expect(new Set(drawing.points.map((point) => point.id)).size).toBe(
      drawing.points.length,
    );
  });

  it('assigns devices and routes to known circuits', () => {
    const { drawing } = project;
    const circuitIds = new Set(drawing.circuits.map((circuit) => circuit.id));

    for (const point of drawing.points) {
      if (point.properties.circuitId) {
        expect(circuitIds.has(point.properties.circuitId)).toBe(true);
      }
    }
    for (const route of drawing.routes) {
      expect(route.circuitId && circuitIds.has(route.circuitId)).toBe(true);
      expect(route.geometry.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('has courses connected to devices at both ends', () => {
    const { drawing } = project;
    const points = new Set(
      drawing.points.map((point) => `${point.x}:${point.y}`),
    );

    for (const route of drawing.routes) {
      const start = route.geometry[0]!;
      const end = route.geometry[route.geometry.length - 1]!;
      expect(points.has(`${start.x}:${start.y}`)).toBe(true);
      expect(points.has(`${end.x}:${end.y}`)).toBe(true);
    }
  });
});
