import type {
  Circuit,
  PublicCalibration,
  PublicDimension,
  PublicOpening,
  PublicPoint,
  PublicRoom,
  PublicRoute,
  PublicWall,
  RouteSettings,
} from '@drawmyplace/contracts';
import { createLocalProject, type LocalProject } from './local-db';

export interface DemoLabels {
  livingRoom: string;
  kitchen: string;
  bedroom: string;
  bathroom: string;
}

const CIRCUITS: Circuit[] = [
  { id: 'L1', name: 'Lighting', color: '#f59e0b' },
  { id: 'L2', name: 'Power', color: '#38bdf8' },
  { id: 'S1', name: 'Living switches', color: '#a78bfa' },
  { id: 'S2', name: 'Kitchen switches', color: '#c084fc' },
  { id: 'LV1', name: 'Low voltage', color: '#34d399' },
];

const CHASE: RouteSettings = {
  wastePercent: 10,
  mounting: 'chase',
  chaseWidthMm: 60,
  chaseDepthMm: 25,
};
const CEILING: RouteSettings = { wastePercent: 10, mounting: 'ceiling' };
const WALL: RouteSettings = { wastePercent: 10, mounting: 'wall' };

/**
 * Ready-made local apartment plan used as a starting point. All coordinates
 * are centimetres (1 unit = 1 cm, calibration 0.01 m per unit).
 */
export function createDemoLocalProject(
  name: string,
  labels: DemoLabels,
): LocalProject {
  const project = createLocalProject(name);
  const now = new Date().toISOString();
  const floorId = project.id;
  const id = () => crypto.randomUUID();

  const point = (
    type: PublicPoint['type'],
    x: number,
    y: number,
    circuitId: string | null,
    subtype: NonNullable<PublicPoint['properties']['subtype']>,
  ): PublicPoint => ({
    id: id(),
    floorId,
    type,
    x,
    y,
    rotation: 0,
    label: null,
    mountingHeight: null,
    properties: { circuitId, subtype },
    updatedAt: now,
  });

  const panel = point('panel', 80, 80, null, 'main-board');
  const livingSocketA = point('socket', 200, 100, 'L2', 'socket-double');
  const livingSocketB = point('socket', 400, 100, 'L2', 'socket-double');
  const livingSwitch = point('switch', 250, 350, 'S1', 'switch-double');
  const livingLight = point('light', 300, 220, 'L1', 'light-ceiling');
  const kitchenSocket = point('socket', 800, 100, 'L2', 'socket-dedicated');
  const kitchenLight = point('light', 800, 220, 'L1', 'light-ceiling');
  const kitchenSwitch = point('switch', 750, 350, 'S2', 'switch-single');
  const bedroomSocket = point('socket', 200, 600, 'L2', 'socket-double');
  const bedroomLight = point('light', 300, 520, 'L1', 'light-ceiling');
  const bedroomSwitch = point('switch', 250, 420, 'S1', 'switch-single');
  const bathLight = point('light', 800, 520, 'L1', 'light-ceiling');
  const bathSwitch = point('switch', 750, 420, 'S2', 'switch-single');
  const lan = point('custom', 450, 300, 'LV1', 'data-lan');
  const camera = point('custom', 900, 600, 'LV1', 'data-camera');

  const wallTop: PublicWall = {
    id: id(),
    floorId,
    geometry: [
      { x: 50, y: 50 },
      { x: 950, y: 50 },
    ],
    thickness: 8,
    label: null,
    updatedAt: now,
  };
  const wallRight: PublicWall = {
    id: id(),
    floorId,
    geometry: [
      { x: 950, y: 50 },
      { x: 950, y: 650 },
    ],
    thickness: 8,
    label: null,
    updatedAt: now,
  };
  const wallBottom: PublicWall = {
    id: id(),
    floorId,
    geometry: [
      { x: 950, y: 650 },
      { x: 50, y: 650 },
    ],
    thickness: 8,
    label: null,
    updatedAt: now,
  };
  const wallLeft: PublicWall = {
    id: id(),
    floorId,
    geometry: [
      { x: 50, y: 650 },
      { x: 50, y: 50 },
    ],
    thickness: 8,
    label: null,
    updatedAt: now,
  };
  const partitionV: PublicWall = {
    id: id(),
    floorId,
    geometry: [
      { x: 600, y: 50 },
      { x: 600, y: 400 },
    ],
    thickness: 8,
    label: null,
    updatedAt: now,
  };
  const partitionH: PublicWall = {
    id: id(),
    floorId,
    geometry: [
      { x: 600, y: 400 },
      { x: 950, y: 400 },
    ],
    thickness: 8,
    label: null,
    updatedAt: now,
  };

  const opening = (
    wallId: string,
    type: PublicOpening['type'],
    offset: number,
    width: number,
    height: number,
    sillHeight: number,
  ): PublicOpening => ({
    id: id(),
    floorId,
    wallId,
    type,
    offset,
    width,
    height,
    sillHeight,
    flipped: false,
    label: null,
    updatedAt: now,
  });

  const room = (
    name: string,
    boundary: PublicRoom['boundary'],
  ): PublicRoom => ({
    id: id(),
    floorId,
    name,
    boundary,
    updatedAt: now,
  });

  const dimension = (
    pointA: PublicDimension['pointA'],
    pointB: PublicDimension['pointB'],
    offset: number,
  ): PublicDimension => ({
    id: id(),
    floorId,
    pointA,
    pointB,
    offset,
    label: null,
    updatedAt: now,
  });

  const route = (
    geometry: PublicRoute['geometry'],
    circuitId: string,
    settings: RouteSettings,
  ): PublicRoute => ({
    id: id(),
    floorId,
    circuitId,
    materialId: null,
    geometry,
    settings,
    updatedAt: now,
  });

  const calibration: PublicCalibration = {
    planId: floorId,
    pointA: { x: 50, y: 50 },
    pointB: { x: 950, y: 50 },
    realDistance: 9,
    unit: 'm',
    metersPerUnit: 0.01,
    updatedAt: now,
  };

  project.drawing = {
    calibration,
    circuits: CIRCUITS,
    walls: [
      wallTop,
      wallRight,
      wallBottom,
      wallLeft,
      partitionV,
      partitionH,
    ],
    rooms: [
      room(labels.livingRoom, [
        { x: 50, y: 50 },
        { x: 600, y: 50 },
        { x: 600, y: 400 },
        { x: 50, y: 400 },
      ]),
      room(labels.kitchen, [
        { x: 600, y: 50 },
        { x: 950, y: 50 },
        { x: 950, y: 400 },
        { x: 600, y: 400 },
      ]),
      room(labels.bedroom, [
        { x: 50, y: 400 },
        { x: 600, y: 400 },
        { x: 600, y: 650 },
        { x: 50, y: 650 },
      ]),
      room(labels.bathroom, [
        { x: 600, y: 400 },
        { x: 950, y: 400 },
        { x: 950, y: 650 },
        { x: 600, y: 650 },
      ]),
    ],
    openings: [
      opening(wallTop.id, 'window', 180, 150, 140, 90),
      opening(wallRight.id, 'window', 180, 150, 140, 90),
      opening(wallLeft.id, 'door', 260, 100, 210, 0),
      opening(partitionV.id, 'door', 160, 90, 210, 0),
      opening(partitionH.id, 'door', 140, 90, 210, 0),
    ],
    dimensions: [
      dimension({ x: 50, y: 50 }, { x: 950, y: 50 }, -40),
      dimension({ x: 50, y: 50 }, { x: 50, y: 650 }, -40),
    ],
    points: [
      panel,
      livingSocketA,
      livingSocketB,
      livingSwitch,
      livingLight,
      kitchenSocket,
      kitchenLight,
      kitchenSwitch,
      bedroomSocket,
      bedroomLight,
      bedroomSwitch,
      bathLight,
      bathSwitch,
      lan,
      camera,
    ],
    routes: [
      route(
        [
          { x: 80, y: 80 },
          { x: 200, y: 80 },
          { x: 200, y: 100 },
        ],
        'L2',
        CHASE,
      ),
      route(
        [
          { x: 200, y: 100 },
          { x: 400, y: 100 },
        ],
        'L2',
        CHASE,
      ),
      route(
        [
          { x: 80, y: 80 },
          { x: 300, y: 80 },
          { x: 300, y: 220 },
        ],
        'L1',
        CEILING,
      ),
      route(
        [
          { x: 250, y: 350 },
          { x: 300, y: 350 },
          { x: 300, y: 220 },
        ],
        'S1',
        WALL,
      ),
      route(
        [
          { x: 80, y: 80 },
          { x: 800, y: 80 },
          { x: 800, y: 100 },
        ],
        'L2',
        CHASE,
      ),
      route(
        [
          { x: 800, y: 100 },
          { x: 800, y: 220 },
        ],
        'L1',
        CEILING,
      ),
      route(
        [
          { x: 750, y: 350 },
          { x: 800, y: 350 },
          { x: 800, y: 220 },
        ],
        'S2',
        WALL,
      ),
      route(
        [
          { x: 80, y: 80 },
          { x: 80, y: 600 },
          { x: 200, y: 600 },
        ],
        'L2',
        CHASE,
      ),
      route(
        [
          { x: 200, y: 600 },
          { x: 200, y: 520 },
          { x: 300, y: 520 },
        ],
        'L1',
        CEILING,
      ),
      route(
        [
          { x: 250, y: 420 },
          { x: 300, y: 420 },
          { x: 300, y: 520 },
        ],
        'S1',
        WALL,
      ),
      route(
        [
          { x: 800, y: 100 },
          { x: 800, y: 520 },
        ],
        'L1',
        CHASE,
      ),
      route(
        [
          { x: 750, y: 420 },
          { x: 800, y: 420 },
          { x: 800, y: 520 },
        ],
        'S2',
        WALL,
      ),
      route(
        [
          { x: 80, y: 80 },
          { x: 450, y: 80 },
          { x: 450, y: 300 },
        ],
        'LV1',
        CEILING,
      ),
      route(
        [
          { x: 80, y: 80 },
          { x: 900, y: 80 },
          { x: 900, y: 600 },
        ],
        'LV1',
        CHASE,
      ),
    ],
  };
  project.viewport = { x: 500, y: 350, zoom: 0.9 };
  project.updatedAt = now;

  return project;
}
