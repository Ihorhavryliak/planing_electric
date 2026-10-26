import { describe, expect, it } from 'vitest';
import { calculateElectrical } from '@drawmyplace/calculations';
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
});
