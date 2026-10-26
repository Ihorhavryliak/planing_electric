import { describe, expect, it } from 'vitest';
import type { PlanDrawing } from '@drawmyplace/contracts';
import { buildIfc, ifcGuid, ifcString } from './ifc-export';

const drawing = {
  planId: 'pl1',
  calibration: { metersPerUnit: 0.01 },
  walls: [
    {
      id: 'w1',
      floorId: 'f1',
      geometry: [
        { x: 100, y: 100 },
        { x: 400, y: 100 },
      ],
      thickness: 15,
      label: 'North wall',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  openings: [
    {
      id: 'o1',
      floorId: 'f1',
      wallId: 'w1',
      type: 'door',
      offset: 50,
      width: 90,
      height: 210,
      sillHeight: 0,
      flipped: false,
      label: 'Door',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  rooms: [
    {
      id: 'room1',
      floorId: 'f1',
      name: 'Kitchen',
      boundary: [
        { x: 100, y: 100 },
        { x: 400, y: 100 },
        { x: 400, y: 400 },
        { x: 100, y: 400 },
      ],
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  dimensions: [],
  points: [
    {
      id: 'p1',
      floorId: 'f1',
      type: 'socket',
      x: 200,
      y: 100,
      rotation: 0,
      label: 'TV socket',
      mountingHeight: 0.3,
      properties: { circuitId: 'C1', subtype: 'socket-double' },
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'p2',
      floorId: 'f1',
      type: 'light',
      x: 300,
      y: 100,
      rotation: 0,
      label: null,
      mountingHeight: null,
      properties: { circuitId: 'C1', subtype: 'light-ceiling' },
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  routes: [
    {
      id: 'r1',
      floorId: 'f1',
      circuitId: 'C1',
      materialId: null,
      geometry: [
        { x: 100, y: 100 },
        { x: 400, y: 100 },
      ],
      settings: { mounting: 'ceiling' },
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
} as unknown as PlanDrawing;

function build(overrides: Partial<Parameters<typeof buildIfc>[0]> = {}) {
  return buildIfc({
    projectName: 'Квартира',
    planName: 'Поверх 1',
    drawing,
    circuits: [{ id: 'C1', name: 'Sockets' }],
    ...overrides,
  });
}

function definitions(text: string): Map<number, string> {
  const map = new Map<number, string>();
  const pattern = /^#(\d+)=(.*);$/gm;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    map.set(Number(match[1]), match[2] ?? '');
  }

  return map;
}

const IFC_GUID_RE = /^[0-9A-Za-z_$]{22}$/;

describe('IFC export', () => {
  it('writes an IFC4 STEP header and all plan entities', () => {
    const result = build();
    const text = result.text;

    expect(text.startsWith('ISO-10303-21;')).toBe(true);
    expect(text).toContain("FILE_SCHEMA(('IFC4'));");
    expect(text.endsWith('END-ISO-10303-21;\n')).toBe(true);
    expect(text).toContain('IFCWALL(');
    expect(text).toContain('IFCOPENINGELEMENT(');
    expect(text).toContain('IFCRELVOIDSELEMENT(');
    expect(text).toContain('IFCOUTLET(');
    expect(text).toContain('IFCLIGHTFIXTURE(');
    expect(text).toContain('IFCCABLESEGMENT(');
    expect(text).toContain('IFCSPACE(');
    expect(text).toContain('IFCRELCONTAINEDINSPATIALSTRUCTURE(');
    expect(text).toContain('IFCRELDEFINESBYPROPERTIES(');
    expect(result.stats).toMatchObject({
      walls: 1,
      openings: 1,
      points: 2,
      routes: 1,
      rooms: 1,
    });
    expect(result.stats.entities).toBeGreaterThan(40);
  });

  it('produces well-formed entity lines with only defined references', () => {
    const text = build().text;
    const dataStart = text.indexOf('DATA;') + 5;
    const data = text.slice(dataStart, text.indexOf('ENDSEC;', dataStart));
    const entityLines = data
      .split('\n')
      .filter((line) => line.startsWith('#'));

    expect(entityLines.length).toBeGreaterThan(40);
    for (const line of entityLines) {
      expect(line).toMatch(/^#\d+=.+,?.*;$/);
      expect(line.endsWith(';')).toBe(true);
    }

    const defined = definitions(text);
    expect(new Set([...defined.keys()]).size).toBe(defined.size);

    const referenced = new Set(
      [...text.matchAll(/#(\d+)/g)].map((match) => Number(match[1])),
    );

    for (const id of referenced) {
      expect(defined.has(id)).toBe(true);
    }
  });

  it('scales drawing units to metres and sets explicit coordinates', () => {
    const text = build().text;

    expect(text).toContain('IFCCARTESIANPOINT((1.,-1.,0.))');
    expect(text).toContain('IFCRECTANGLEPROFILEDEF(.AREA.,$,');
    expect(text).toContain(',3.,0.15)');
    expect(text).toContain('IFCEXTRUDEDAREASOLID(');
    expect(text).toContain(',2.7)');
    expect(text).toContain('IFCCARTESIANPOINT((1.,-1.,2.55))');
    expect(text).toContain('IFCPROPERTYSINGLEVALUE(\'PlanLength\',$');
  });

  it('creates opening voids with the correct size and sill height', () => {
    const text = build().text;

    expect(text).toContain(',0.9,0.17)');
    expect(text).toContain('IFCOPENINGELEMENT(');
    expect(text).toContain("'Door'");
  });

  it('writes circuits, mounting heights and subtypes as property sets', () => {
    const text = build().text;

    expect(text).toContain("IFCLABEL('Sockets')");
    expect(text).toContain("IFCPROPERTYSINGLEVALUE('Circuit',$");
    expect(text).toContain("IFCPROPERTYSINGLEVALUE('Mounting',$");
    expect(text).toContain("IFCLABEL('ceiling')");
    expect(text).toContain("IFCPROPERTYSINGLEVALUE('Subtype',$");
    expect(text).toContain("IFCLABEL('socket-double')");
  });

  it('escapes Ukrainian names and keeps 22-character IFC GUIDs', () => {
    const text = build().text;
    const ids = [...text.matchAll(/IFC(?:WALL|OUTLET|LIGHTFIXTURE|CABLESEGMENT)\('([^']+)',/g)];

    expect(text).toContain('\\X2\\');
    expect(ids.length).toBeGreaterThanOrEqual(3);
    for (const match of ids) {
      const id = match[1] ?? '';
      expect(id).toHaveLength(22);
      expect(IFC_GUID_RE.test(id)).toBe(true);
    }
    expect(ifcGuid('same')).toBe(ifcGuid('same'));
    expect(ifcGuid('same')).not.toBe(ifcGuid('other'));
  });

  it('falls back to 1 cm units when the plan is not calibrated', () => {
    const result = build({
      drawing: { ...drawing, calibration: null } as unknown as PlanDrawing,
    });

    expect(result.calibrated).toBe(false);
    expect(result.scale).toBe(0.01);
    expect(result.text).toContain('IFCCARTESIANPOINT((1.,-1.,0.))');
  });

  it('uses the configured wall height and ignores empty plans', () => {
    const empty = build({
      drawing: {
        ...drawing,
        walls: [],
        openings: [],
        rooms: [],
        points: [],
        routes: [],
      } as unknown as PlanDrawing,
      wallHeightMeters: 3.1,
    });

    expect(empty.stats).toMatchObject({
      walls: 0,
      openings: 0,
      points: 0,
      routes: 0,
      rooms: 0,
    });
    expect(empty.text).not.toContain('IFCRELCONTAINEDINSPATIALSTRUCTURE');
  });

  it('escapes STEP strings and quotes', () => {
    expect(ifcString("O'Brien")).toBe("'O''Brien'");
    expect(ifcString('a\\b')).toBe("'a\\\\b'");
    expect(ifcString('Кухня')).toContain('\\X2\\041A\\X0\\');
  });

  it('uses a safe file name', () => {
    expect(build().fileName).toBe('Квартира-Поверх-1.ifc');
  });
});
