import { describe, expect, it } from 'vitest';
import {
  buildPanelSchedule,
  calculateElectrical,
} from '@drawmyplace/calculations';
import type { Circuit, PlanDrawing } from '@drawmyplace/contracts';
import {
  buildReportCsv,
  buildReportTable,
  buildReportsWorkbook,
  normalizeReportFields,
  reportFileName,
  type ReportSource,
} from './reports';

const dictionary: Record<string, string> = {
  'report.field.item': 'Item',
  'report.field.type': 'Type',
  'report.field.circuitAddress': 'Circuit',
  'report.field.circuitName': 'Circuit name',
  'report.field.quantity': 'Qty',
  'report.field.unit': 'Unit',
  'report.field.mounting': 'Mounting',
  'report.field.notes': 'Notes',
  'report.field.devices': 'Devices',
  'report.field.routes': 'Routes',
  'report.total': 'Total',
  'report.unit.pcs': 'pcs',
  'report.pointType.socket': 'Socket',
  'report.pointType.light': 'Light',
  'devices.subtype.socket-double': 'Double socket',
  'devices.subtype.light-ceiling': 'Ceiling light',
  'journal.address': 'Address',
  'journal.wire': 'Wire',
  'journal.terminal': 'Terminal',
  'journal.circuit': 'Circuit',
  'journal.name': 'Name',
  'journal.phase': 'Phase',
  'journal.breaker': 'Breaker',
  'journal.rcd': 'RCD',
  'journal.cable': 'Cable',
  'journal.length': 'Length, m',
  'panel.way': 'Way',
  'panel.circuit': 'Circuit',
  'panel.name': 'Name',
  'panel.phase': 'Phase',
  'panel.protection': 'Protection',
  'panel.rcd': 'RCD',
  'panel.cable': 'Cable',
  'panel.load': 'Load, A',
  'panel.drop': 'ΔU',
  'panel.module': 'modules',
  'panel.status': 'Status',
  'panel.statusOk': 'OK',
  'panel.statusWarning': 'Warning',
  'panel.statusError': 'Error',
};

const t = (key: string, params?: Record<string, string | number>): string => {
  const template = dictionary[key] ?? key;

  return params
    ? template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? ''))
    : template;
};

const circuits: Circuit[] = [
  { id: 'C1', name: 'Sockets', color: '#f59e0b' },
  { id: 'C2', name: 'Lighting', color: '#38bdf8' },
];

const point = (
  id: string,
  type: 'socket' | 'light',
  subtype: string,
  circuitId: string,
  extra: Record<string, unknown> = {},
) => ({
  id,
  floorId: 'f1',
  type,
  x: 0,
  y: 0,
  rotation: 0,
  label: null,
  mountingHeight: null,
  properties: { circuitId, subtype },
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

const points = [
  point('p1', 'socket', 'socket-double', 'C1', {
    label: 'TV',
    mountingHeight: 0.3,
  }),
  point('p2', 'socket', 'socket-double', 'C1', { mountingHeight: 0.3 }),
  point('p3', 'light', 'light-ceiling', 'C2'),
];

const routes = [
  {
    id: 'r1',
    floorId: 'f1',
    circuitId: 'C1',
    materialId: null,
    geometry: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ],
    settings: {},
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'r2',
    floorId: 'f1',
    circuitId: 'C1',
    materialId: null,
    geometry: [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ],
    settings: {},
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

const drawing = {
  planId: 'pl1',
  calibration: null,
  walls: [],
  openings: [],
  rooms: [],
  dimensions: [],
  points,
  routes,
} as unknown as PlanDrawing;

const electrical = calculateElectrical({
  circuits: circuits.map((circuit) => ({
    id: circuit.id,
    name: circuit.name,
  })),
  devices: points.map((item) => ({
    id: item.id,
    circuitId: item.properties.circuitId,
    type: item.type,
    subtype: item.properties.subtype,
  })),
  lengthsByCircuit: { C1: 15 },
  calibrated: true,
});

const decoded = new TextDecoder('latin1');

const source: ReportSource = {
  t,
  drawing,
  circuits,
  calculation: {
    planId: 'pl1',
    metersPerUnit: 0.01,
    routes: [
      {
        routeId: 'r1',
        circuitId: 'C1',
        status: 'ok',
        planLength: null,
        verticalLength: null,
        wastePercent: null,
        wasteLength: null,
        requiredLength: 10,
        drops: [],
        warnings: [],
      },
      {
        routeId: 'r2',
        circuitId: 'C1',
        status: 'ok',
        planLength: null,
        verticalLength: null,
        wastePercent: null,
        wasteLength: null,
        requiredLength: 5,
        drops: [],
        warnings: [],
      },
    ],
    totalRequiredLength: 15,
    warnings: [],
  },
  electrical,
  panelSchedule: buildPanelSchedule(electrical),
};

describe('report templates', () => {
  it('groups equipment by subtype and circuit with a quantity total', () => {
    const table = buildReportTable('equipment', source);

    expect(table.columns.map((column) => column.key)).toEqual([
      'item',
      'type',
      'circuit',
      'circuitName',
      'quantity',
      'unit',
      'mounting',
    ]);
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]?.slice(0, 2)).toEqual(['Ceiling light', 'Light']);
    expect(table.rows[1]?.slice(0, 7)).toEqual([
      'Double socket',
      'Socket',
      'Q1-1L1',
      'Sockets',
      2,
      'pcs',
      '0.3 m',
    ]);
    expect(table.total?.[4]).toBe(3);
  });

  it('honours a custom field selection in template order', () => {
    const fields = normalizeReportFields('equipment', [
      'notes',
      'quantity',
      'item',
      'unknown',
    ]);
    const table = buildReportTable('equipment', source, fields);

    expect(fields).toEqual(['item', 'quantity', 'notes']);
    expect(table.columns.map((column) => column.key)).toEqual([
      'item',
      'quantity',
      'notes',
    ]);
    expect(table.rows[1]?.[2]).toBe('TV');
  });

  it('sums journal lengths and writes an Excel-friendly CSV', () => {
    const table = buildReportTable('cable-journal', source, [
      'address',
      'name',
      'length',
    ]);
    const csv = buildReportCsv(table);

    expect(table.rows[0]).toEqual(['Q1-1L1', 'Sockets', 15]);
    expect(table.total).toEqual(['Total', '', 15]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Address;Name;"Length, m"');
    expect(csv).toContain('Q1-1L1;Sockets;15');
    expect(csv).toContain('Total;;15');
  });

  it('exports panel rows with translated status labels', () => {
    const table = buildReportTable('panel-schedule', source);

    expect(table.rows).toHaveLength(2);
    expect(table.rows[0]).toContain('OK');
    expect(table.columns.map((column) => column.key)).toContain('protection');
    expect(table.total?.[7]).toBeGreaterThan(0);
  });

  it('builds a multi-sheet workbook with all three reports', () => {
    const tables = (['equipment', 'cable-journal', 'panel-schedule'] as const).map(
      (id) => ({ id, table: buildReportTable(id, source) }),
    );
    const bytes = buildReportsWorkbook(tables);
    const text = decoded.decode(bytes);

    expect(String.fromCharCode(bytes[0]!, bytes[1]!)).toBe('PK');
    expect(text).toContain('xl/worksheets/sheet1.xml');
    expect(text).toContain('xl/worksheets/sheet3.xml');
    expect(text).toContain('Double socket');
    expect(text).toContain('Panel schedule');
    expect(text).toContain('Total');
  });

  it('returns empty tables without a drawing', () => {
    const empty: ReportSource = { ...source, drawing: null, points: [], routes: [] };
    const table = buildReportTable('equipment', empty);

    expect(table.rows).toHaveLength(0);
    expect(table.total).toBeUndefined();
  });

  it('creates safe report file names', () => {
    expect(reportFileName('Квартира №5', 'equipment', 'xlsx')).toMatch(
      /^Квартира-5-equipment-\d{4}-\d{2}-\d{2}\.xlsx$/,
    );
  });
});
