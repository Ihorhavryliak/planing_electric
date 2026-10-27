import { describe, expect, it } from 'vitest';
import {
  buildSignalingTakeoff,
  calculateElectrical,
} from '@drawmyplace/calculations';
import { validatePlan, type ValidationInput } from './validation';

function baseInput(): ValidationInput {
  return {
    calibration: { metersPerUnit: 0.01 },
    circuits: [{ id: 'C1' }],
    points: [
      { id: 'p1', type: 'panel', x: 0, y: 0, properties: { circuitId: 'C1' } },
      { id: 'p2', type: 'socket', x: 100, y: 0, properties: { circuitId: 'C1' } },
    ],
    routes: [
      {
        id: 'r1',
        circuitId: 'C1',
        materialId: 'm1',
        geometry: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        settings: { mounting: 'ceiling' },
      },
    ],
    walls: [],
    openings: [],
    materialIds: ['m1'],
  };
}

function codes(input: ValidationInput): string[] {
  return validatePlan(input).map((issue) => issue.code);
}

describe('plan validation', () => {
  it('returns no issues for a clean calibrated plan', () => {
    expect(validatePlan(baseInput())).toEqual([]);
  });

  it('warns when the plan is not calibrated', () => {
    const input = baseInput();
    input.calibration = null;
    expect(codes(input)).toEqual(['uncalibrated']);
  });

  it('aggregates devices and routes without a circuit', () => {
    const input = baseInput();
    input.points = input.points.map((point) => ({
      ...point,
      properties: {},
    }));
    input.routes[0]!.circuitId = null;

    const issues = validatePlan(input);
    expect(issues.map((issue) => issue.code)).toEqual([
      'pointWithoutCircuit',
      'routeWithoutCircuit',
      'unusedCircuit',
    ]);
    expect(issues[0]?.count).toBe(2);
    expect(issues[1]?.targets).toEqual([{ kind: 'route', id: 'r1' }]);
  });

  it('flags unknown circuits, duplicate codes and unknown materials', () => {
    const input = baseInput();
    input.circuits = [{ id: 'C1' }, { id: 'C1' }, { id: 'C2' }];
    input.points[0]!.properties.circuitId = 'C9';
    input.routes[0]!.materialId = 'missing';
    input.materialIds = ['m1'];

    expect(codes(input)).toEqual([
      'duplicateCircuit',
      'pointUnknownCircuit',
      'routeUnknownMaterial',
      'unusedCircuit',
    ]);
  });

  it('finds isolated devices and loose route ends', () => {
    const input = baseInput();
    input.points = [
      ...input.points,
      {
        id: 'p3',
        type: 'light',
        x: 50,
        y: 50,
        properties: { circuitId: 'C1' },
      },
    ];
    input.routes[0]!.geometry = [
      { x: 0, y: 0 },
      { x: 100, y: 50 },
    ];

    const issues = validatePlan(input);
    expect(issues.map((issue) => issue.code)).toEqual([
      'isolatedPoint',
      'routeUnconnectedEnds',
    ]);
    expect(
      issues.find((issue) => issue.code === 'isolatedPoint')?.targets,
    ).toEqual([
      { kind: 'point', id: 'p2' },
      { kind: 'point', id: 'p3' },
    ]);
  });

  it('rejects openings that do not fit their wall', () => {
    const input = baseInput();
    input.walls = [
      {
        id: 'w1',
        geometry: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
      },
    ];
    input.openings = [
      { id: 'o1', wallId: 'w1', offset: 90, width: 20 },
      { id: 'o2', wallId: 'unknown', offset: 10, width: 20 },
    ];

    expect(codes(input)).toEqual([
      'openingMissingWall',
      'openingOutsideWall',
    ]);
  });

  it('reports unused circuits and wall crossings as information', () => {
    const input = baseInput();
    input.circuits = [...input.circuits, { id: 'C2' }];
    input.walls = [
      {
        id: 'w1',
        geometry: [
          { x: 50, y: -10 },
          { x: 50, y: 10 },
        ],
      },
    ];

    const issues = validatePlan(input);
    expect(issues.map((issue) => issue.code)).toEqual([
      'routeCrossesWall',
      'unusedCircuit',
    ]);
    expect(issues.every((issue) => issue.severity === 'info')).toBe(true);
  });

  it('marks zero-length routes as errors', () => {
    const input = baseInput();
    input.routes[0]!.geometry = [
      { x: 10, y: 10 },
      { x: 10, y: 10 },
    ];

    const issues = validatePlan(input);
    expect(issues[0]?.code).toBe('routeZeroLength');
    expect(issues[0]?.severity).toBe('error');
  });

  it('adds electrical coordination issues and targets the affected circuit', () => {
    const input = baseInput();
    input.electrical = calculateElectrical({
      circuits: [{ id: 'C1', name: 'Sockets' }],
      devices: [
        {
          id: 'p2',
          circuitId: 'C1',
          type: 'socket',
          subtype: 'socket-dedicated',
          powerW: 4_000,
          demandFactor: 1,
        },
      ],
      lengthsByCircuit: { C1: 20 },
    });

    const issue = validatePlan(input).find(
      (item) => item.code === 'currentExceedsBreaker',
    );

    expect(issue?.severity).toBe('error');
    expect(issue?.targets).toEqual([{ kind: 'circuit', id: 'C1' }]);
    expect(issue?.params?.current).toBeGreaterThan(16);
  });

  it('checks explicit route pins against points', () => {
    const input = baseInput();
    input.routes[0]!.startPointId = 'p1';
    expect(codes(input)).not.toContain('pinnedEndMismatch');

    input.routes[0]!.geometry = [
      { x: 10, y: 10 },
      { x: 100, y: 0 },
    ];
    expect(codes(input)).toContain('pinnedEndMismatch');

    input.routes[0]!.startPointId = '99999999-9999-4999-8999-999999999999';
    expect(codes(input)).toContain('pinnedPointMissing');
  });

  it('applies wet-room RCD rules and shows normative references', () => {
    const input = baseInput();
    input.points = input.points.map((point, index) =>
      index === 1
        ? {
            ...point,
            x: 100,
            y: 0,
            type: 'socket',
            properties: { circuitId: 'C1' },
          }
        : point,
    );
    input.rooms = [
      {
        id: 'room-1',
        name: 'Bathroom',
        boundary: [
          { x: 50, y: -50 },
          { x: 150, y: -50 },
          { x: 150, y: 50 },
          { x: 50, y: 50 },
        ],
      },
    ];
    input.electrical = calculateElectrical({
      circuits: [{ id: 'C1', name: 'Sockets' }],
      devices: [{ id: 'p2', circuitId: 'C1', type: 'socket' }],
      lengthsByCircuit: { C1: 10 },
      settings: { defaultRcd: null },
    });

    const issue = validatePlan(input).find(
      (item) => item.code === 'normWetZoneRcd',
    );
    expect(issue?.severity).toBe('error');
    expect(issue?.norm).toContain('ПУЭ 7.1.79');
    expect(issue?.params?.room).toBe('Bathroom');
  });

  it('does not flag a wet-room socket protected by a 30 mA RCD', () => {
    const input = baseInput();
    input.rooms = [
      {
        id: 'room-1',
        name: 'Sanvuzol',
        boundary: [
          { x: 50, y: -50 },
          { x: 150, y: -50 },
          { x: 150, y: 50 },
          { x: 50, y: 50 },
        ],
      },
    ];
    input.electrical = calculateElectrical({
      circuits: [{ id: 'C1', name: 'Sockets' }],
      devices: [{ id: 'p2', circuitId: 'C1', type: 'socket' }],
      lengthsByCircuit: { C1: 10 },
    });

    expect(codes(input)).not.toContain('normWetZoneRcd');
  });

  it('adds a normative reference to cable/breaker mismatches', () => {
    const input = baseInput();
    input.electrical = calculateElectrical({
      circuits: [{ id: 'C1', name: 'Sockets' }],
      devices: [
        {
          id: 'p2',
          circuitId: 'C1',
          type: 'socket',
          powerW: 4_000,
          demandFactor: 1,
        },
      ],
      lengthsByCircuit: { C1: 20 },
    });

    const issue = validatePlan(input).find(
      (item) => item.code === 'currentExceedsBreaker',
    );
    expect(issue?.norm).toContain('ДБН');
  });

  it('flags cable routes that cross on the same mounting level', () => {
    const input = baseInput();
    input.circuits = [{ id: 'C1', name: 'Sockets' }, { id: 'C2', name: 'Lighting' }];
    input.points = [
      ...input.points,
      {
        id: 'p3',
        type: 'light',
        x: 50,
        y: 50,
        properties: { circuitId: 'C2' },
      },
    ];
    input.routes = [
      ...input.routes,
      {
        id: 'r2',
        circuitId: 'C2',
        geometry: [
          { x: 50, y: -50 },
          { x: 50, y: 50 },
        ],
        settings: { mounting: 'ceiling' },
      },
    ];

    const issue = validatePlan(input).find((item) => item.code === 'routeClash');
    expect(issue?.severity).toBe('error');
    expect(issue?.params).toEqual({ route: 'Sockets', other: 'Lighting' });
    expect(issue?.targets).toEqual([
      { kind: 'route', id: 'r1' },
      { kind: 'route', id: 'r2' },
    ]);
  });

  it('ignores crossings when routes are on different mounting levels', () => {
    const input = baseInput();
    input.circuits = [{ id: 'C1' }, { id: 'C2' }];
    input.points = [
      ...input.points,
      { id: 'p3', type: 'light', x: 50, y: 50, properties: { circuitId: 'C2' } },
    ];
    input.routes = [
      ...input.routes,
      {
        id: 'r2',
        circuitId: 'C2',
        geometry: [
          { x: 50, y: -50 },
          { x: 50, y: 50 },
        ],
        settings: { mounting: 'floor' },
      },
    ];

    expect(codes(input)).not.toContain('routeClash');
  });

  it('flags routes passing through another circuit device', () => {
    const input = baseInput();
    input.circuits = [{ id: 'C1', name: 'Sockets' }, { id: 'C2', name: 'Lighting' }];
    input.points = [
      ...input.points,
      {
        id: 'p3',
        type: 'switch',
        x: 50,
        y: 0,
        properties: { circuitId: 'C2' },
      },
    ];
    input.routes = [
      ...input.routes,
      {
        id: 'r2',
        circuitId: 'C2',
        geometry: [
          { x: 50, y: 0 },
          { x: 50, y: 80 },
        ],
        settings: { mounting: 'ceiling' },
      },
    ];

    const issue = validatePlan(input).find(
      (item) => item.code === 'routePointClash',
    );
    expect(issue?.severity).toBe('error');
    expect(issue?.params).toEqual({ route: 'Sockets' });
  });
});

describe('signaling validation', () => {
  const loop = {
    id: 'F1',
    code: 'F1',
    name: 'Fire loop',
    type: 'fire' as const,
    topology: 'loop' as const,
    maxDevices: 2,
    maxLength: 500,
    panelId: 'panel',
  };

  function signalingInput(address: number) {
    const input = baseInput();
    input.signalingLoops = [loop];
    input.deviceProducts = [
      { id: 'panel-a', subtype: 'fire-panel', system: 'fire' },
      {
        id: 'smoke-a',
        subtype: 'smoke-detector',
        system: 'fire',
        compatibility: ['panel-a'],
        loopAddressable: true,
      },
      { id: 'panel-b', subtype: 'fire-panel', system: 'fire' },
    ];
    input.points = [
      {
        id: 'panel',
        type: 'panel',
        x: 0,
        y: 0,
        properties: { circuitId: 'C1', productId: 'panel-a', loopId: 'F1' },
      },
      {
        id: 'smoke',
        type: 'custom',
        x: 100,
        y: 0,
        properties: {
          circuitId: 'C1',
          productId: 'smoke-a',
          subtype: 'smoke-detector',
          loopId: 'F1',
          address,
        },
      },
      {
        id: 'orphan',
        type: 'custom',
        x: 150,
        y: 0,
        properties: {
          circuitId: 'C1',
          productId: 'smoke-a',
          subtype: 'smoke-detector',
        },
      },
      {
        id: 'bad-loop',
        type: 'custom',
        x: 200,
        y: 0,
        properties: {
          circuitId: 'C1',
          productId: 'smoke-a',
          subtype: 'smoke-detector',
          loopId: 'missing',
        },
      },
    ];
    input.routes = [
      {
        id: 'r1',
        circuitId: 'C1',
        materialId: 'm1',
        geometry: [
          { x: 0, y: 0 },
          { x: 200, y: 0 },
        ],
        settings: { mounting: 'chase', system: 'fire', loopId: 'F1' },
      },
      {
        id: 'r2',
        circuitId: 'C1',
        materialId: 'm2',
        geometry: [
          { x: 0, y: 2 },
          { x: 200, y: 2 },
        ],
        settings: { mounting: 'chase', system: 'power' },
      },
    ];
    input.rooms = [
      {
        id: 'room-1',
        name: 'Hall',
        boundary: [
          { x: 0, y: -50 },
          { x: 300, y: -50 },
          { x: 300, y: 100 },
          { x: 0, y: 100 },
        ],
      },
      {
        id: 'room-2',
        name: 'Store',
        boundary: [
          { x: 400, y: 0 },
          { x: 700, y: 0 },
          { x: 700, y: 300 },
          { x: 400, y: 300 },
        ],
      },
    ];
    input.materialIds = ['m1', 'm2'];
    input.materials = [
      { id: 'm1', code: 'FR-CABLE', name: 'Fire resistant cable' },
      { id: 'm2', code: 'NYM', name: 'Power cable' },
    ];
    input.signaling = buildSignalingTakeoff({
      loops: [loop],
      points: input.points.map((point) => ({
        id: point.id,
        subtype: point.properties.subtype,
        loopId: point.properties.loopId,
        address: point.properties.address,
        x: point.x,
        y: point.y,
        coverageAreaM2: 85,
      })),
      routes: input.routes.map((route) => ({
        id: route.id,
        system: route.settings.system as
          | 'power'
          | 'security'
          | 'fire'
          | 'cctv'
          | 'pa'
          | 'data'
          | undefined,
        loopId: route.settings.loopId,
        mounting: route.settings.mounting,
        geometry: route.geometry,
      })),
      rooms: input.rooms,
      metersPerUnit: 0.01,
    });

    return input;
  }

  it('flags missing/unknown loops, bad addresses and panel mismatches', () => {
    const input = signalingInput(300);
    input.points[0]!.properties.productId = 'panel-b';
    const issues = validatePlan(input);
    const codes = issues.map((issue) => issue.code);

    expect(codes).toEqual(
      expect.arrayContaining([
        'signalingPointWithoutLoop',
        'signalingUnknownLoop',
        'signalingAddressOutOfRange',
        'signalingIncompatiblePanel',
        'signalingFireCoverage',
      ]),
    );
    expect(
      issues.find((issue) => issue.code === 'signalingPointWithoutLoop')
        ?.targets,
    ).toEqual([{ kind: 'point', id: 'orphan' }]);
  });

  it('reports duplicate addresses and shared chases with norm clauses', () => {
    const input = signalingInput(1);
    input.points = [...input.points, {
      id: 'smoke-2',
      type: 'custom',
      x: 120,
      y: 0,
      properties: {
        circuitId: 'C1',
        productId: 'smoke-a',
        subtype: 'smoke-detector',
        loopId: 'F1',
        address: 1,
      },
    }];
    input.points = input.points.filter((point) => point.id !== 'bad-loop');
    const issues = validatePlan(input);

    const duplicate = issues.find(
      (issue) => issue.code === 'signalingDuplicateAddress',
    );
    const chase = issues.find(
      (issue) => issue.code === 'signalingSharedChase',
    );
    expect(duplicate).toBeDefined();
    expect(duplicate?.norm).toContain('EN 54-2');
    expect(chase).toBeDefined();
    expect(chase?.norm).toContain('ДБН');
  });

  it('requires FR cable on fire loops', () => {
    const input = signalingInput(1);
    input.routes[0]!.materialId = 'm2';
    const issue = validatePlan(input).find(
      (item) => item.code === 'signalingFireCableNotFr',
    );

    expect(issue?.severity).toBe('error');
    expect(issue?.targets).toEqual([{ kind: 'route', id: 'r1' }]);
  });
});
