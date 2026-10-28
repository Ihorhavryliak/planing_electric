import { createDatabase, projectTemplates } from '../index';
import type {
  LocalizedTemplateText,
  TemplatePlanPayload,
} from '@drawmyplace/contracts';
import { templatePlanPayloadSchema } from '@drawmyplace/contracts';

/**
 * Starter projects. One drawing unit is one centimetre; every template is
 * calibrated with 100 units = 1 m so lengths, drops and estimates work
 * immediately after creation.
 */
const STAMP = '2026-01-01T00:00:00.000Z';
const UNITS_PER_METER = 100;

interface DeviceSpec {
  type: 'socket' | 'switch' | 'light' | 'panel' | 'junction' | 'custom';
  x: number;
  y: number;
  circuitId?: string | null;
  subtype?: string | null;
  label?: string | null;
  mountingHeight?: number | null;
  rotation?: number;
}

interface RouteSpec {
  circuitId: string | null;
  geometry: Array<{ x: number; y: number }>;
  mounting?: 'ceiling' | 'floor' | 'wall' | 'chase';
  elevationMm?: number;
  start?: number;
  end?: number;
}

interface TemplateDraft {
  code: string;
  sortOrder: number;
  name: LocalizedTemplateText;
  description: LocalizedTemplateText;
  previewSvg: string;
  rooms: Array<{
    name: string;
    boundary: Array<{ x: number; y: number }>;
  }>;
  walls: Array<{
    geometry: Array<{ x: number; y: number }>;
    thickness?: number | null;
    label?: string | null;
  }>;
  devices: DeviceSpec[];
  routes: RouteSpec[];
  circuits: Array<{ id: string; name: string; color: string }>;
}

function idFactory(templateIndex: number): () => string {
  let counter = 0;
  const prefix = (0x10000000 + templateIndex).toString(16).padStart(8, '0');

  return () => {
    counter += 1;

    return `${prefix}-0000-4000-8000-${counter
      .toString(16)
      .padStart(12, '0')}`;
  };
}

function buildPayload(
  draft: TemplateDraft,
  templateIndex: number,
): TemplatePlanPayload {
  const nextId = idFactory(templateIndex);
  const planId = nextId();
  const floorId = nextId();
  const pointIds: string[] = [];

  const walls = draft.walls.map((wall) => ({
    id: nextId(),
    floorId,
    geometry: wall.geometry,
    thickness: wall.thickness ?? 15,
    label: wall.label ?? null,
    updatedAt: STAMP,
  }));

  const points = draft.devices.map((device) => {
    const id = nextId();
    pointIds.push(id);

    return {
      id,
      floorId,
      type: device.type,
      x: device.x,
      y: device.y,
      rotation: device.rotation ?? 0,
      label: device.label ?? null,
      mountingHeight: device.mountingHeight ?? null,
      properties: {
        ...(device.circuitId ? { circuitId: device.circuitId } : {}),
        ...(device.subtype ? { subtype: device.subtype } : {}),
      },
      updatedAt: STAMP,
    };
  });

  const routes = draft.routes.map((route) => ({
    id: nextId(),
    floorId,
    circuitId: route.circuitId,
    materialId: null,
    geometry: route.geometry,
    settings: {
      ...(route.mounting ? { mounting: route.mounting } : {}),
      ...(route.elevationMm !== undefined
        ? { elevationMm: route.elevationMm }
        : {}),
    },
    ...(route.start !== undefined
      ? { startPointId: pointIds[route.start] ?? null }
      : {}),
    ...(route.end !== undefined
      ? { endPointId: pointIds[route.end] ?? null }
      : {}),
    updatedAt: STAMP,
  }));

  const rooms = draft.rooms.map((room) => ({
    id: nextId(),
    floorId,
    name: room.name,
    boundary: room.boundary,
    updatedAt: STAMP,
  }));

  return templatePlanPayloadSchema.parse({
    planId,
    floorId,
    calibration: {
      planId,
      pointA: { x: 0, y: 0 },
      pointB: { x: UNITS_PER_METER, y: 0 },
      realDistance: 1,
      unit: 'm',
      metersPerUnit: 1 / UNITS_PER_METER,
      updatedAt: STAMP,
    },
    walls,
    openings: [],
    rooms,
    dimensions: [],
    points,
    routes,
    calculationSettings: {
      circuits: draft.circuits,
    },
  });
}

function rect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Array<{ x: number; y: number }> {
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ];
}

function insetRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  inset = 20,
): Array<{ x: number; y: number }> {
  return rect(x1 + inset, y1 + inset, x2 - inset, y2 - inset);
}

function outerWalls(
  width: number,
  height: number,
  thickness = 20,
): TemplateDraft['walls'] {
  return [
    {
      geometry: [
        { x: 0, y: 0 },
        { x: width, y: 0 },
      ],
      thickness,
    },
    {
      geometry: [
        { x: width, y: 0 },
        { x: width, y: height },
      ],
      thickness,
    },
    {
      geometry: [
        { x: width, y: height },
        { x: 0, y: height },
      ],
      thickness,
    },
    {
      geometry: [
        { x: 0, y: height },
        { x: 0, y: 0 },
      ],
      thickness,
    },
  ];
}

const PALETTE = {
  lighting: '#f59e0b',
  sockets: '#38bdf8',
  bedroom: '#a78bfa',
  meeting: '#34d399',
  water: '#f472b6',
};

const CIRCUIT_L1 = { id: 'L1', name: 'Lighting', color: PALETTE.lighting };
const CIRCUIT_S1 = { id: 'S1', name: 'Sockets', color: PALETTE.sockets };

const APARTMENT_1BR: TemplateDraft = {
  code: 'apartment_1br',
  sortOrder: 10,
  name: {
    ua: '1-кімнатна квартира · 35 м²',
    en: '1-bedroom apartment · 35 m²',
    ru: '1-комнатная квартира · 35 м²',
  },
  description: {
    ua: 'Готова студія 8 × 4,5 м: вітальня, розетки, світло, щит і траси.',
    en: 'Ready 8 × 4.5 m studio: living room, sockets, lighting, board and routes.',
    ru: 'Готовая студия 8 × 4,5 м: гостиная, розетки, свет, щит и трассы.',
  },
  previewSvg:
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect width="200" height="150" fill="#0f172a"/><rect x="18" y="22" width="164" height="106" fill="#111c2e" stroke="#94a3b8" stroke-width="4"/><rect x="30" y="34" width="140" height="82" fill="#0e2a33" stroke="#2dd4bf" stroke-width="1.5"/><path d="M28 120 H150" stroke="#38bdf8" stroke-width="2"/><path d="M50 24 V60 H100" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4 3"/><circle cx="50" cy="120" r="3" fill="#38bdf8"/><circle cx="110" cy="120" r="3" fill="#38bdf8"/><circle cx="150" cy="24" r="3" fill="#f59e0b"/><circle cx="100" cy="70" r="4" fill="#fbbf24"/></svg>',
  rooms: [
    { name: 'Living room', boundary: insetRect(0, 0, 800, 450) },
  ],
  walls: outerWalls(800, 450),
  circuits: [CIRCUIT_L1, CIRCUIT_S1],
  devices: [
    {
      type: 'panel',
      x: 40,
      y: 40,
      subtype: 'main-board',
      label: 'Panel',
      mountingHeight: 1.5,
    },
    {
      type: 'socket',
      x: 200,
      y: 430,
      subtype: 'socket-double',
      circuitId: 'S1',
      mountingHeight: 0.3,
    },
    {
      type: 'socket',
      x: 420,
      y: 430,
      subtype: 'socket-double',
      circuitId: 'S1',
      mountingHeight: 0.3,
    },
    {
      type: 'switch',
      x: 120,
      y: 30,
      subtype: 'switch-single',
      circuitId: 'L1',
      mountingHeight: 1.1,
    },
    {
      type: 'light',
      x: 400,
      y: 225,
      subtype: 'light-ceiling',
      circuitId: 'L1',
      mountingHeight: 2.3,
    },
  ],
  routes: [
    {
      circuitId: 'L1',
      geometry: [
        { x: 40, y: 40 },
        { x: 120, y: 40 },
        { x: 120, y: 30 },
      ],
      mounting: 'wall',
      elevationMm: 1100,
      start: 0,
      end: 3,
    },
    {
      circuitId: 'L1',
      geometry: [
        { x: 120, y: 30 },
        { x: 120, y: 225 },
        { x: 400, y: 225 },
      ],
      mounting: 'ceiling',
      elevationMm: 2650,
      start: 3,
      end: 4,
    },
    {
      circuitId: 'S1',
      geometry: [
        { x: 40, y: 40 },
        { x: 40, y: 430 },
        { x: 200, y: 430 },
      ],
      mounting: 'wall',
      elevationMm: 300,
      start: 0,
      end: 1,
    },
    {
      circuitId: 'S1',
      geometry: [
        { x: 200, y: 430 },
        { x: 420, y: 430 },
      ],
      mounting: 'wall',
      elevationMm: 300,
      start: 1,
      end: 2,
    },
  ],
};

const APARTMENT_2BR: TemplateDraft = {
  code: 'apartment_2br',
  sortOrder: 20,
  name: {
    ua: '2-кімнатна квартира · 55 м²',
    en: '2-bedroom apartment · 55 m²',
    ru: '2-комнатная квартира · 55 м²',
  },
  description: {
    ua: 'Вітальня, спальня й кухня з трьома колами та готовими трасами.',
    en: 'Living room, bedroom and kitchen with three circuits and ready routes.',
    ru: 'Гостиная, спальня и кухня с тремя цепями и готовыми трассами.',
  },
  previewSvg:
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect width="200" height="150" fill="#0f172a"/><rect x="12" y="18" width="176" height="114" fill="#111c2e" stroke="#94a3b8" stroke-width="4"/><rect x="22" y="28" width="98" height="94" fill="#0e2a33" stroke="#2dd4bf"/><rect x="128" y="28" width="52" height="42" fill="#1b2233" stroke="#a78bfa"/><rect x="128" y="78" width="52" height="44" fill="#0e2a33" stroke="#38bdf8"/><path d="M24 112 H110" stroke="#38bdf8" stroke-width="2"/><path d="M40 22 V48 H90" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4 3"/><path d="M150 22 V70 H170" stroke="#a78bfa" stroke-width="2" stroke-dasharray="4 3"/><circle cx="40" cy="112" r="3" fill="#38bdf8"/><circle cx="90" cy="112" r="3" fill="#38bdf8"/><circle cx="150" cy="80" r="3" fill="#a78bfa"/><circle cx="70" cy="70" r="4" fill="#fbbf24"/></svg>',
  rooms: [
    { name: 'Living room', boundary: insetRect(0, 0, 600, 550) },
    { name: 'Bedroom', boundary: insetRect(600, 0, 1000, 300) },
    { name: 'Kitchen', boundary: insetRect(600, 300, 1000, 550) },
  ],
  walls: [
    ...outerWalls(1000, 550),
    {
      geometry: [
        { x: 600, y: 0 },
        { x: 600, y: 200 },
      ],
      thickness: 15,
    },
    {
      geometry: [
        { x: 600, y: 290 },
        { x: 600, y: 550 },
      ],
      thickness: 15,
    },
    {
      geometry: [
        { x: 600, y: 300 },
        { x: 700, y: 300 },
      ],
      thickness: 15,
    },
    {
      geometry: [
        { x: 790, y: 300 },
        { x: 1000, y: 300 },
      ],
      thickness: 15,
    },
  ],
  circuits: [
    CIRCUIT_L1,
    { id: 'L2', name: 'Bedroom', color: PALETTE.bedroom },
    CIRCUIT_S1,
  ],
  devices: [
    {
      type: 'panel',
      x: 40,
      y: 40,
      subtype: 'main-board',
      label: 'Panel',
      mountingHeight: 1.5,
    },
    {
      type: 'socket',
      x: 250,
      y: 530,
      subtype: 'socket-double',
      circuitId: 'S1',
      mountingHeight: 0.3,
    },
    {
      type: 'socket',
      x: 450,
      y: 530,
      subtype: 'socket-double',
      circuitId: 'S1',
      mountingHeight: 0.3,
    },
    {
      type: 'socket',
      x: 800,
      y: 280,
      subtype: 'socket-double',
      circuitId: 'L2',
      mountingHeight: 0.3,
    },
    {
      type: 'socket',
      x: 850,
      y: 530,
      subtype: 'socket-kitchen',
      circuitId: 'S1',
      mountingHeight: 1.1,
    },
    {
      type: 'switch',
      x: 120,
      y: 30,
      subtype: 'switch-single',
      circuitId: 'L1',
      mountingHeight: 1.1,
    },
    {
      type: 'switch',
      x: 650,
      y: 30,
      subtype: 'switch-single',
      circuitId: 'L2',
      mountingHeight: 1.1,
    },
    {
      type: 'switch',
      x: 620,
      y: 320,
      subtype: 'switch-single',
      circuitId: 'L1',
      mountingHeight: 1.1,
    },
    {
      type: 'light',
      x: 300,
      y: 275,
      subtype: 'light-ceiling',
      circuitId: 'L1',
      mountingHeight: 2.3,
    },
    {
      type: 'light',
      x: 800,
      y: 420,
      subtype: 'light-ceiling',
      circuitId: 'L1',
      mountingHeight: 2.3,
    },
  ],
  routes: [
    {
      circuitId: 'L1',
      geometry: [
        { x: 40, y: 40 },
        { x: 120, y: 40 },
        { x: 120, y: 30 },
      ],
      mounting: 'wall',
      elevationMm: 1100,
      start: 0,
      end: 5,
    },
    {
      circuitId: 'L1',
      geometry: [
        { x: 120, y: 30 },
        { x: 120, y: 275 },
        { x: 300, y: 275 },
      ],
      mounting: 'ceiling',
      elevationMm: 2650,
      start: 5,
      end: 8,
    },
    {
      circuitId: 'L1',
      geometry: [
        { x: 40, y: 40 },
        { x: 40, y: 320 },
        { x: 620, y: 320 },
      ],
      mounting: 'wall',
      elevationMm: 1100,
      start: 0,
      end: 7,
    },
    {
      circuitId: 'L1',
      geometry: [
        { x: 620, y: 320 },
        { x: 800, y: 320 },
        { x: 800, y: 420 },
      ],
      mounting: 'ceiling',
      elevationMm: 2650,
      start: 7,
      end: 9,
    },
    {
      circuitId: 'S1',
      geometry: [
        { x: 40, y: 40 },
        { x: 40, y: 530 },
        { x: 250, y: 530 },
      ],
      mounting: 'wall',
      elevationMm: 300,
      start: 0,
      end: 1,
    },
    {
      circuitId: 'S1',
      geometry: [
        { x: 250, y: 530 },
        { x: 450, y: 530 },
      ],
      mounting: 'wall',
      elevationMm: 300,
      start: 1,
      end: 2,
    },
    {
      circuitId: 'S1',
      geometry: [
        { x: 40, y: 40 },
        { x: 40, y: 540 },
        { x: 850, y: 540 },
        { x: 850, y: 530 },
      ],
      mounting: 'wall',
      elevationMm: 1100,
      start: 0,
      end: 4,
    },
    {
      circuitId: 'L2',
      geometry: [
        { x: 40, y: 40 },
        { x: 40, y: 10 },
        { x: 650, y: 10 },
        { x: 650, y: 30 },
      ],
      mounting: 'wall',
      elevationMm: 1100,
      start: 0,
      end: 6,
    },
  ],
};

const HOUSE_2FL: TemplateDraft = {
  code: 'house_2fl',
  sortOrder: 30,
  name: {
    ua: 'Двоповерховий будинок · 120 м²',
    en: 'Two-storey house · 120 m²',
    ru: 'Двухэтажный дом · 120 м²',
  },
  description: {
    ua: 'Перший поверх 12 × 10 м: вітальня, кухня, спальня і санвузол, 5 кіл.',
    en: 'Ground floor 12 × 10 m: living room, kitchen, bedroom and bathroom, 5 circuits.',
    ru: 'Первый этаж 12 × 10 м: гостиная, кухня, спальня и санузел, 5 цепей.',
  },
  previewSvg:
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect width="200" height="150" fill="#0f172a"/><rect x="10" y="12" width="180" height="126" fill="#111c2e" stroke="#94a3b8" stroke-width="4"/><rect x="20" y="22" width="94" height="106" fill="#0e2a33" stroke="#2dd4bf"/><rect x="120" y="22" width="60" height="36" fill="#1b2233" stroke="#f59e0b"/><rect x="120" y="64" width="60" height="30" fill="#1b2233" stroke="#a78bfa"/><rect x="120" y="100" width="60" height="28" fill="#1b2233" stroke="#f472b6"/><path d="M24 122 H100" stroke="#38bdf8" stroke-width="2"/><path d="M40 16 V44 H90" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4 3"/><path d="M150 16 V60 H176" stroke="#34d399" stroke-width="2" stroke-dasharray="4 3"/><circle cx="60" cy="80" r="4" fill="#fbbf24"/><circle cx="150" cy="44" r="3" fill="#f59e0b"/></svg>',
  rooms: [
    { name: 'Living room', boundary: insetRect(0, 0, 710, 1000) },
    { name: 'Kitchen', boundary: insetRect(710, 0, 1200, 490) },
    { name: 'Bedroom', boundary: insetRect(710, 490, 1200, 790) },
    { name: 'Bathroom', boundary: insetRect(710, 790, 1200, 1000) },
  ],
  walls: [
    ...outerWalls(1200, 1000),
    {
      geometry: [
        { x: 710, y: 0 },
        { x: 710, y: 300 },
      ],
      thickness: 15,
    },
    {
      geometry: [
        { x: 710, y: 340 },
        { x: 710, y: 490 },
      ],
      thickness: 15,
    },
    {
      geometry: [
        { x: 710, y: 490 },
        { x: 710, y: 790 },
      ],
      thickness: 15,
    },
    {
      geometry: [
        { x: 710, y: 790 },
        { x: 710, y: 1000 },
      ],
      thickness: 15,
    },
    {
      geometry: [
        { x: 710, y: 490 },
        { x: 900, y: 490 },
      ],
      thickness: 15,
    },
    {
      geometry: [
        { x: 950, y: 490 },
        { x: 1200, y: 490 },
      ],
      thickness: 15,
    },
    {
      geometry: [
        { x: 710, y: 790 },
        { x: 900, y: 790 },
      ],
      thickness: 15,
    },
    {
      geometry: [
        { x: 950, y: 790 },
        { x: 1200, y: 790 },
      ],
      thickness: 15,
    },
  ],
  circuits: [
    { id: 'L1', name: 'Living lighting', color: PALETTE.lighting },
    { id: 'L2', name: 'Kitchen lighting', color: PALETTE.meeting },
    { id: 'L3', name: 'Bedroom lighting', color: PALETTE.bedroom },
    CIRCUIT_S1,
    { id: 'W1', name: 'Bathroom', color: PALETTE.water },
  ],
  devices: [
    {
      type: 'panel',
      x: 40,
      y: 40,
      subtype: 'main-board',
      label: 'Panel',
      mountingHeight: 1.5,
    },
    {
      type: 'socket',
      x: 200,
      y: 980,
      subtype: 'socket-double',
      circuitId: 'S1',
      mountingHeight: 0.3,
    },
    {
      type: 'socket',
      x: 450,
      y: 980,
      subtype: 'socket-double',
      circuitId: 'S1',
      mountingHeight: 0.3,
    },
    {
      type: 'socket',
      x: 650,
      y: 980,
      subtype: 'socket-double',
      circuitId: 'S1',
      mountingHeight: 0.3,
    },
    {
      type: 'socket',
      x: 800,
      y: 480,
      subtype: 'socket-kitchen',
      circuitId: 'S1',
      mountingHeight: 1.1,
    },
    {
      type: 'socket',
      x: 1100,
      y: 480,
      subtype: 'socket-kitchen',
      circuitId: 'S1',
      mountingHeight: 1.1,
    },
    {
      type: 'socket',
      x: 900,
      y: 780,
      subtype: 'socket-double',
      circuitId: 'S1',
      mountingHeight: 0.3,
    },
    {
      type: 'switch',
      x: 120,
      y: 20,
      subtype: 'switch-single',
      circuitId: 'L1',
      mountingHeight: 1.1,
    },
    {
      type: 'switch',
      x: 740,
      y: 20,
      subtype: 'switch-single',
      circuitId: 'L2',
      mountingHeight: 1.1,
    },
    {
      type: 'switch',
      x: 740,
      y: 500,
      subtype: 'switch-single',
      circuitId: 'L3',
      mountingHeight: 1.1,
    },
    {
      type: 'light',
      x: 350,
      y: 500,
      subtype: 'light-ceiling',
      circuitId: 'L1',
      mountingHeight: 2.3,
    },
    {
      type: 'light',
      x: 950,
      y: 250,
      subtype: 'light-ceiling',
      circuitId: 'L2',
      mountingHeight: 2.3,
    },
    {
      type: 'light',
      x: 950,
      y: 650,
      subtype: 'light-ceiling',
      circuitId: 'L3',
      mountingHeight: 2.3,
    },
    {
      type: 'light',
      x: 950,
      y: 900,
      subtype: 'light-ceiling',
      circuitId: 'W1',
      mountingHeight: 2.3,
    },
    {
      type: 'light',
      x: 700,
      y: 880,
      subtype: 'light-wall',
      circuitId: 'L1',
      mountingHeight: 2.0,
    },
  ],
  routes: [
    {
      circuitId: 'L1',
      geometry: [
        { x: 40, y: 40 },
        { x: 120, y: 40 },
        { x: 120, y: 20 },
      ],
      mounting: 'wall',
      elevationMm: 1100,
      start: 0,
      end: 7,
    },
    {
      circuitId: 'L1',
      geometry: [
        { x: 120, y: 20 },
        { x: 120, y: 500 },
        { x: 350, y: 500 },
      ],
      mounting: 'ceiling',
      elevationMm: 2650,
      start: 7,
      end: 10,
    },
    {
      circuitId: 'L2',
      geometry: [
        { x: 40, y: 40 },
        { x: 40, y: 10 },
        { x: 740, y: 10 },
        { x: 740, y: 20 },
      ],
      mounting: 'wall',
      elevationMm: 1100,
      start: 0,
      end: 8,
    },
    {
      circuitId: 'L2',
      geometry: [
        { x: 740, y: 20 },
        { x: 740, y: 250 },
        { x: 950, y: 250 },
      ],
      mounting: 'ceiling',
      elevationMm: 2650,
      start: 8,
      end: 11,
    },
    {
      circuitId: 'L3',
      geometry: [
        { x: 40, y: 40 },
        { x: 40, y: 500 },
        { x: 740, y: 500 },
      ],
      mounting: 'wall',
      elevationMm: 1100,
      start: 0,
      end: 9,
    },
    {
      circuitId: 'L3',
      geometry: [
        { x: 740, y: 500 },
        { x: 740, y: 650 },
        { x: 950, y: 650 },
      ],
      mounting: 'ceiling',
      elevationMm: 2650,
      start: 9,
      end: 12,
    },
    {
      circuitId: 'W1',
      geometry: [
        { x: 40, y: 40 },
        { x: 40, y: 900 },
        { x: 950, y: 900 },
      ],
      mounting: 'ceiling',
      elevationMm: 2650,
      start: 0,
      end: 13,
    },
    {
      circuitId: 'S1',
      geometry: [
        { x: 40, y: 40 },
        { x: 40, y: 980 },
        { x: 200, y: 980 },
      ],
      mounting: 'wall',
      elevationMm: 300,
      start: 0,
      end: 1,
    },
    {
      circuitId: 'S1',
      geometry: [
        { x: 200, y: 980 },
        { x: 650, y: 980 },
      ],
      mounting: 'wall',
      elevationMm: 300,
      start: 1,
      end: 3,
    },
    {
      circuitId: 'S1',
      geometry: [
        { x: 40, y: 40 },
        { x: 40, y: 480 },
        { x: 800, y: 480 },
      ],
      mounting: 'wall',
      elevationMm: 1100,
      start: 0,
      end: 4,
    },
  ],
};

const OFFICE_OPEN: TemplateDraft = {
  code: 'office_open',
  sortOrder: 40,
  name: {
    ua: 'Відкритий офіс · 80 м²',
    en: 'Open office · 80 m²',
    ru: 'Открытый офис · 80 м²',
  },
  description: {
    ua: 'Open space і переговорна 10 × 8 м: 12 пристроїв, 4 кола, 9 трас.',
    en: 'Open space and meeting room 10 × 8 m: 12 devices, 4 circuits, 9 routes.',
    ru: 'Open space и переговорная 10 × 8 м: 12 устройств, 4 цепи, 9 трасс.',
  },
  previewSvg:
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect width="200" height="150" fill="#0f172a"/><rect x="10" y="14" width="180" height="122" fill="#111c2e" stroke="#94a3b8" stroke-width="4"/><rect x="20" y="24" width="92" height="102" fill="#0e2a33" stroke="#2dd4bf"/><rect x="122" y="24" width="58" height="102" fill="#1b2233" stroke="#34d399"/><path d="M26 112 H108" stroke="#38bdf8" stroke-width="2"/><path d="M38 18 V48 H96" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4 3"/><path d="M150 18 V70" stroke="#34d399" stroke-width="2" stroke-dasharray="4 3"/><circle cx="60" cy="70" r="4" fill="#fbbf24"/><circle cx="150" cy="70" r="4" fill="#fbbf24"/></svg>',
  rooms: [
    { name: 'Open space', boundary: insetRect(0, 0, 700, 800) },
    { name: 'Meeting room', boundary: insetRect(700, 0, 1000, 800) },
  ],
  walls: [
    ...outerWalls(1000, 800),
    {
      geometry: [
        { x: 700, y: 0 },
        { x: 700, y: 300 },
      ],
      thickness: 15,
    },
    {
      geometry: [
        { x: 700, y: 400 },
        { x: 700, y: 800 },
      ],
      thickness: 15,
    },
  ],
  circuits: [
    { id: 'L1', name: 'Open lighting', color: PALETTE.lighting },
    { id: 'L2', name: 'Meeting lighting', color: PALETTE.meeting },
    CIRCUIT_S1,
    { id: 'S2', name: 'Meeting power', color: PALETTE.bedroom },
  ],
  devices: [
    {
      type: 'panel',
      x: 40,
      y: 40,
      subtype: 'main-board',
      label: 'Panel',
      mountingHeight: 1.5,
    },
    {
      type: 'socket',
      x: 150,
      y: 780,
      subtype: 'socket-double',
      circuitId: 'S1',
      mountingHeight: 0.3,
    },
    {
      type: 'socket',
      x: 350,
      y: 780,
      subtype: 'socket-double',
      circuitId: 'S1',
      mountingHeight: 0.3,
    },
    {
      type: 'socket',
      x: 550,
      y: 780,
      subtype: 'socket-double',
      circuitId: 'S1',
      mountingHeight: 0.3,
    },
    {
      type: 'socket',
      x: 150,
      y: 500,
      subtype: 'socket-double',
      circuitId: 'S1',
      mountingHeight: 0.3,
    },
    {
      type: 'socket',
      x: 750,
      y: 500,
      subtype: 'socket-double',
      circuitId: 'S2',
      mountingHeight: 0.3,
    },
    {
      type: 'socket',
      x: 950,
      y: 500,
      subtype: 'socket-double',
      circuitId: 'S2',
      mountingHeight: 0.3,
    },
    {
      type: 'switch',
      x: 100,
      y: 20,
      subtype: 'switch-single',
      circuitId: 'L1',
      mountingHeight: 1.1,
    },
    {
      type: 'switch',
      x: 720,
      y: 20,
      subtype: 'switch-single',
      circuitId: 'L2',
      mountingHeight: 1.1,
    },
    {
      type: 'switch',
      x: 720,
      y: 780,
      subtype: 'switch-two-way',
      circuitId: 'L2',
      mountingHeight: 1.1,
    },
    {
      type: 'light',
      x: 400,
      y: 400,
      subtype: 'light-ceiling',
      circuitId: 'L1',
      mountingHeight: 2.6,
    },
    {
      type: 'light',
      x: 850,
      y: 400,
      subtype: 'light-ceiling',
      circuitId: 'L2',
      mountingHeight: 2.6,
    },
  ],
  routes: [
    {
      circuitId: 'L1',
      geometry: [
        { x: 40, y: 40 },
        { x: 100, y: 40 },
        { x: 100, y: 20 },
      ],
      mounting: 'wall',
      elevationMm: 1100,
      start: 0,
      end: 7,
    },
    {
      circuitId: 'L1',
      geometry: [
        { x: 100, y: 20 },
        { x: 100, y: 400 },
        { x: 400, y: 400 },
      ],
      mounting: 'ceiling',
      elevationMm: 2650,
      start: 7,
      end: 10,
    },
    {
      circuitId: 'L2',
      geometry: [
        { x: 40, y: 40 },
        { x: 40, y: 10 },
        { x: 720, y: 10 },
        { x: 720, y: 20 },
      ],
      mounting: 'wall',
      elevationMm: 1100,
      start: 0,
      end: 8,
    },
    {
      circuitId: 'L2',
      geometry: [
        { x: 720, y: 20 },
        { x: 720, y: 400 },
        { x: 850, y: 400 },
      ],
      mounting: 'ceiling',
      elevationMm: 2650,
      start: 8,
      end: 11,
    },
    {
      circuitId: 'S1',
      geometry: [
        { x: 40, y: 40 },
        { x: 40, y: 780 },
        { x: 150, y: 780 },
      ],
      mounting: 'wall',
      elevationMm: 300,
      start: 0,
      end: 1,
    },
    {
      circuitId: 'S1',
      geometry: [
        { x: 150, y: 780 },
        { x: 550, y: 780 },
      ],
      mounting: 'wall',
      elevationMm: 300,
      start: 1,
      end: 3,
    },
    {
      circuitId: 'S1',
      geometry: [
        { x: 150, y: 780 },
        { x: 150, y: 500 },
      ],
      mounting: 'wall',
      elevationMm: 300,
      start: 1,
      end: 4,
    },
    {
      circuitId: 'S2',
      geometry: [
        { x: 40, y: 40 },
        { x: 40, y: 500 },
        { x: 750, y: 500 },
      ],
      mounting: 'wall',
      elevationMm: 300,
      start: 0,
      end: 5,
    },
    {
      circuitId: 'S2',
      geometry: [
        { x: 750, y: 500 },
        { x: 950, y: 500 },
      ],
      mounting: 'wall',
      elevationMm: 300,
      start: 5,
      end: 6,
    },
  ],
};

const DRAFTS: TemplateDraft[] = [
  APARTMENT_1BR,
  APARTMENT_2BR,
  HOUSE_2FL,
  OFFICE_OPEN,
];

export interface ProjectTemplateSeed {
  code: string;
  name: LocalizedTemplateText;
  description: LocalizedTemplateText;
  previewSvg: string;
  planPayload: TemplatePlanPayload;
  isPublic: boolean;
  sortOrder: number;
}

export const PROJECT_TEMPLATES: ProjectTemplateSeed[] = DRAFTS.map(
  (draft, index) => ({
    code: draft.code,
    name: draft.name,
    description: draft.description,
    previewSvg: draft.previewSvg,
    planPayload: buildPayload(draft, index + 1),
    isPublic: true,
    sortOrder: draft.sortOrder,
  }),
);

/** Raw insert rows, shared by the CLI seed and the integration tests. */
export function templateRows(): Array<typeof projectTemplates.$inferInsert> {
  return PROJECT_TEMPLATES.map((template) => ({
    code: template.code,
    name: template.name,
    description: template.description,
    previewSvg: template.previewSvg,
    planPayload: template.planPayload as unknown as Record<string, unknown>,
    isPublic: template.isPublic,
    sortOrder: template.sortOrder,
  }));
}

/** Inserts/updates the catalog. Safe to run repeatedly. */
export async function seedProjectTemplates(
  db: ReturnType<typeof createDatabase>['db'],
): Promise<number> {
  for (const row of templateRows()) {
    await db
      .insert(projectTemplates)
      .values(row)
      .onConflictDoUpdate({
        target: projectTemplates.code,
        set: {
          name: row.name,
          description: row.description,
          previewSvg: row.previewSvg,
          planPayload: row.planPayload,
          isPublic: row.isPublic,
          sortOrder: row.sortOrder,
        },
      });
  }

  return PROJECT_TEMPLATES.length;
}

/** CLI entry point for `pnpm db:seed:templates`. */
export async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL is required to seed project templates');
  }

  const { db, client } = createDatabase(url);

  try {
    const count = await seedProjectTemplates(db);
    console.log(`Seeded ${count} project templates`);
  } finally {
    await client.end();
  }
}
