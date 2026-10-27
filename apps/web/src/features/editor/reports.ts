import type {
  Circuit,
  PlanCalculation,
  PublicMaterial,
  PublicPoint,
  PublicRoute,
  SignalingLoop,
} from '@drawmyplace/contracts';
import {
  buildPanelSchedule,
  type ElectricalPlanResult,
  type PanelSchedule,
  type SignalingTakeoff,
} from '@drawmyplace/calculations';
import { deviceProduct } from '@drawmyplace/contracts';
import { buildCableJournal, type CableJournalRow } from './cable-journal';
import { buildCircuitNumbering } from './circuit-numbering';
import { buildXlsx, type XlsxSheet } from './xlsx';

export type ReportId =
  | 'equipment'
  | 'cable-journal'
  | 'panel-schedule'
  | 'signaling-equipment'
  | 'signaling-cable'
  | 'ppkp-schedule'
  | 'battery-report';

export interface ReportFieldDefinition {
  key: string;
  labelKey: string;
  /** Right-aligns numeric columns in previews and exports. */
  numeric?: boolean;
}

export interface ReportDefinition {
  id: ReportId;
  titleKey: string;
  hintKey: string;
  fields: readonly ReportFieldDefinition[];
  defaultFields: readonly string[];
}

export interface ReportColumn {
  key: string;
  label: string;
  numeric: boolean;
}

export type ReportCell = string | number;

export interface ReportTable {
  columns: ReportColumn[];
  rows: ReportCell[][];
  /** Totals row aligned with the columns; omitted for empty reports. */
  total?: ReportCell[];
}

export type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/** The drawing fields reports need; both server and local plans satisfy it. */
export interface ReportDrawing {
  points: readonly PublicPoint[];
  routes: readonly PublicRoute[];
}

export interface ReportSource {
  t: Translate;
  drawing: ReportDrawing | null;
  circuits: readonly Circuit[];
  points?: readonly PublicPoint[];
  routes?: readonly PublicRoute[];
  calculation?: PlanCalculation | null;
  electrical?: ElectricalPlanResult | null;
  panelSchedule?: PanelSchedule | null;
  materials?: readonly PublicMaterial[];
  /** Required cable length by circuit, meters. Overrides calculation routes. */
  cableLengths?: Readonly<Record<string, number>>;
  /** Signaling loops and their computed takeoff (Phase 20). */
  signalingLoops?: readonly SignalingLoop[];
  signaling?: SignalingTakeoff | null;
}

const equipmentFields: readonly ReportFieldDefinition[] = [
  { key: 'item', labelKey: 'report.field.item' },
  { key: 'type', labelKey: 'report.field.type' },
  { key: 'manufacturer', labelKey: 'report.field.manufacturer' },
  { key: 'article', labelKey: 'report.field.article' },
  { key: 'circuit', labelKey: 'report.field.circuitAddress' },
  { key: 'circuitName', labelKey: 'report.field.circuitName' },
  { key: 'quantity', labelKey: 'report.field.quantity', numeric: true },
  { key: 'unit', labelKey: 'report.field.unit' },
  { key: 'unitPrice', labelKey: 'report.field.unitPrice', numeric: true },
  { key: 'totalCost', labelKey: 'report.field.totalCost', numeric: true },
  { key: 'mounting', labelKey: 'report.field.mounting' },
  { key: 'notes', labelKey: 'report.field.notes' },
];

const journalFields: readonly ReportFieldDefinition[] = [
  { key: 'address', labelKey: 'journal.address' },
  { key: 'wire', labelKey: 'journal.wire' },
  { key: 'terminal', labelKey: 'journal.terminal' },
  { key: 'circuit', labelKey: 'journal.circuit' },
  { key: 'name', labelKey: 'journal.name' },
  { key: 'phase', labelKey: 'journal.phase' },
  { key: 'breaker', labelKey: 'journal.breaker' },
  { key: 'rcd', labelKey: 'journal.rcd' },
  { key: 'cable', labelKey: 'journal.cable' },
  { key: 'length', labelKey: 'journal.length', numeric: true },
  { key: 'devices', labelKey: 'report.field.devices', numeric: true },
  { key: 'routes', labelKey: 'report.field.routes', numeric: true },
];

const panelFields: readonly ReportFieldDefinition[] = [
  { key: 'way', labelKey: 'panel.way', numeric: true },
  { key: 'circuit', labelKey: 'panel.circuit' },
  { key: 'name', labelKey: 'panel.name' },
  { key: 'phase', labelKey: 'panel.phase' },
  { key: 'protection', labelKey: 'panel.protection' },
  { key: 'rcd', labelKey: 'panel.rcd' },
  { key: 'cable', labelKey: 'panel.cable' },
  { key: 'load', labelKey: 'panel.load', numeric: true },
  { key: 'drop', labelKey: 'panel.drop', numeric: true },
  { key: 'modules', labelKey: 'panel.module', numeric: true },
  { key: 'status', labelKey: 'panel.status' },
];


const signalingEquipmentFields: readonly ReportFieldDefinition[] = [
  { key: 'loop', labelKey: 'report.field.loop' },
  { key: 'loopName', labelKey: 'report.field.loopName' },
  { key: 'system', labelKey: 'report.field.system' },
  { key: 'address', labelKey: 'report.field.address' },
  { key: 'manufacturer', labelKey: 'report.field.manufacturer' },
  { key: 'article', labelKey: 'report.field.article' },
  { key: 'name', labelKey: 'report.field.name' },
  { key: 'quantity', labelKey: 'report.field.quantity', numeric: true },
  { key: 'unit', labelKey: 'report.field.unit' },
  { key: 'standby', labelKey: 'report.field.standby', numeric: true },
  { key: 'alarm', labelKey: 'report.field.alarm', numeric: true },
];

const signalingCableFields: readonly ReportFieldDefinition[] = [
  { key: 'loop', labelKey: 'report.field.loop' },
  { key: 'system', labelKey: 'report.field.system' },
  { key: 'cable', labelKey: 'report.field.cable' },
  { key: 'length', labelKey: 'report.field.length', numeric: true },
  { key: 'devices', labelKey: 'report.field.devices', numeric: true },
  { key: 'addresses', labelKey: 'report.field.addresses' },
  { key: 'status', labelKey: 'panel.status' },
];

const ppkpFields: readonly ReportFieldDefinition[] = [
  { key: 'loop', labelKey: 'report.field.loop' },
  { key: 'system', labelKey: 'report.field.system' },
  { key: 'topology', labelKey: 'signaling.field.topology' },
  { key: 'devices', labelKey: 'report.field.devices', numeric: true },
  { key: 'used', labelKey: 'report.field.addressesUsed', numeric: true },
  { key: 'free', labelKey: 'report.field.addressesFree', numeric: true },
  { key: 'standby', labelKey: 'report.field.standby', numeric: true },
  { key: 'alarm', labelKey: 'report.field.alarm', numeric: true },
  { key: 'voltage', labelKey: 'report.field.voltage', numeric: true },
  { key: 'drop', labelKey: 'report.field.voltageDrop', numeric: true },
  { key: 'status', labelKey: 'panel.status' },
];

const batteryFields: readonly ReportFieldDefinition[] = [
  { key: 'item', labelKey: 'report.field.item' },
  { key: 'formula', labelKey: 'report.field.formula' },
  { key: 'value', labelKey: 'report.field.value', numeric: true },
  { key: 'unit', labelKey: 'report.field.unit' },
  { key: 'note', labelKey: 'report.field.norm' },
];

export const REPORT_DEFINITIONS: readonly ReportDefinition[] = [
  {
    id: 'signaling-equipment',
    titleKey: 'report.signalingEquipment.title',
    hintKey: 'report.signalingEquipment.hint',
    fields: signalingEquipmentFields,
    defaultFields: [
      'loop',
      'system',
      'address',
      'manufacturer',
      'article',
      'name',
      'quantity',
      'unit',
      'standby',
      'alarm',
    ],
  },
  {
    id: 'signaling-cable',
    titleKey: 'report.signalingCable.title',
    hintKey: 'report.signalingCable.hint',
    fields: signalingCableFields,
    defaultFields: signalingCableFields.map((field) => field.key),
  },
  {
    id: 'ppkp-schedule',
    titleKey: 'report.ppkp.title',
    hintKey: 'report.ppkp.hint',
    fields: ppkpFields,
    defaultFields: ppkpFields.map((field) => field.key),
  },
  {
    id: 'battery-report',
    titleKey: 'report.battery.title',
    hintKey: 'report.battery.hint',
    fields: batteryFields,
    defaultFields: batteryFields.map((field) => field.key),
  },
  {
    id: 'equipment',
    titleKey: 'report.equipment.title',
    hintKey: 'report.equipment.hint',
    fields: equipmentFields,
    defaultFields: [
      'item',
      'type',
      'manufacturer',
      'article',
      'circuit',
      'circuitName',
      'quantity',
      'unit',
      'mounting',
    ],
  },
  {
    id: 'cable-journal',
    titleKey: 'report.journal.title',
    hintKey: 'report.journal.hint',
    fields: journalFields,
    defaultFields: [
      'address',
      'wire',
      'name',
      'phase',
      'breaker',
      'cable',
      'length',
      'devices',
    ],
  },
  {
    id: 'panel-schedule',
    titleKey: 'report.panel.title',
    hintKey: 'report.panel.hint',
    fields: panelFields,
    defaultFields: panelFields.map((field) => field.key),
  },
];

export function getReportDefinition(id: ReportId): ReportDefinition {
  return (
    REPORT_DEFINITIONS.find((definition) => definition.id === id) ??
    REPORT_DEFINITIONS[0]!
  );
}

export function defaultReportFields(id: ReportId): string[] {
  return [...getReportDefinition(id).defaultFields];
}

/** Drops unknown keys and keeps the template's canonical field order. */
export function normalizeReportFields(
  id: ReportId,
  fields: readonly string[],
): string[] {
  const definition = getReportDefinition(id);
  const selected = new Set(fields);
  const known = definition.fields
    .map((field) => field.key)
    .filter((key) => selected.has(key));

  return known.length > 0 ? known : defaultReportFields(id);
}

function typeLabel(point: PublicPoint, t: Translate): string {
  const subtype = point.properties.subtype;

  if (subtype) return t(`devices.subtype.${subtype}`);

  return t(`report.pointType.${point.type}`);
}

function formatNumber(value: number, digits = 1): string {
  return String(Math.round(value * 10 ** digits) / 10 ** digits);
}

function mountingLabel(points: readonly PublicPoint[]): string {
  const heights = [
    ...new Set(
      points
        .map((point) => point.mountingHeight)
        .filter((height): height is number => typeof height === 'number'),
    ),
  ].sort((a, b) => a - b);

  if (heights.length === 0) return '—';
  if (heights.length === 1) return `${formatNumber(heights[0]!, 2)} m`;

  return `${formatNumber(heights[0]!, 2)}–${formatNumber(
    heights[heights.length - 1]!,
    2,
  )} m`;
}

function equipmentRows(
  source: ReportSource,
): { rows: ReportCell[][]; totalQuantity: number; totalCost: number | null } {
  const points = source.points ?? source.drawing?.points ?? [];
  const numbering = buildCircuitNumbering(source.circuits, source.electrical);
  const groups = new Map<
    string,
    {
      points: PublicPoint[];
      circuitId: string | null;
      productId: string | null;
    }
  >();

  for (const point of points) {
    const circuitId = point.properties.circuitId ?? null;
    const productId = point.properties.productId ?? null;
    const key = [
      point.type,
      point.properties.subtype ?? '',
      circuitId ?? '',
      productId ?? '',
    ].join('|');
    const group = groups.get(key);

    if (group) group.points.push(point);
    else groups.set(key, { points: [point], circuitId, productId });
  }

  const rows: ReportCell[][] = [];
  let totalQuantity = 0;
  let totalCost = 0;

  for (const group of groups.values()) {
    const first = group.points[0]!;
    const circuit = group.circuitId
      ? source.circuits.find((item) => item.id === group.circuitId)
      : null;
    const address = group.circuitId
      ? (numbering.circuits[group.circuitId]?.address ?? group.circuitId)
      : '—';
    const labels = [
      ...new Set(
        group.points
          .map((point) => point.label)
          .filter((label): label is string => Boolean(label)),
      ),
    ];
    const product = deviceProduct(group.productId);
    const unitPrice = product?.unitPrice ?? null;
    const cost = unitPrice === null ? null : unitPrice * group.points.length;

    totalQuantity += group.points.length;
    if (cost !== null) totalCost += cost;
    rows.push([
      typeLabel(first, source.t),
      source.t(`report.pointType.${first.type}`),
      product?.manufacturer ?? '—',
      product?.article ?? '—',
      address,
      circuit?.name ?? '—',
      group.points.length,
      source.t('report.unit.pcs'),
      unitPrice ?? '—',
      cost ?? '—',
      mountingLabel(group.points),
      labels.join(', ') || '—',
    ]);
  }

  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  return {
    rows,
    totalQuantity,
    totalCost: totalCost > 0 ? totalCost : null,
  };
}

function journalSourceRows(source: ReportSource): CableJournalRow[] {
  const drawing = source.drawing;
  if (!drawing) return [];

  const routes = source.routes ?? drawing.routes;
  const points = source.points ?? drawing.points;
  const cableLengths: Record<string, number> = {
    ...(source.cableLengths ?? {}),
  };

  if (!source.cableLengths) {
    for (const route of source.calculation?.routes ?? []) {
      if (!route.circuitId) continue;
      cableLengths[route.circuitId] =
        (cableLengths[route.circuitId] ?? 0) + (route.requiredLength ?? 0);
    }
  }

  return buildCableJournal({
    circuits: source.circuits,
    points,
    routes,
    cableLengths,
    electrical: source.electrical ?? null,
    numbering: buildCircuitNumbering(source.circuits, source.electrical),
  });
}

function panelScheduleOf(source: ReportSource): PanelSchedule | null {
  if (source.panelSchedule) return source.panelSchedule;
  if (!source.electrical) return null;

  return buildPanelSchedule(source.electrical);
}

function panelRows(source: ReportSource): ReportCell[][] {
  const schedule = panelScheduleOf(source);
  if (!schedule) return [];

  return schedule.rows.map((row) => [
    row.way,
    row.circuitId,
    row.name,
    row.phase,
    `${row.breaker.ratingA} A ${row.breaker.curve} · ${row.breaker.poles}P`,
    row.rcd ? `${row.rcd.ratingA} A / ${row.rcd.sensitivityMa} mA` : '—',
    `${row.cable.sectionMm2} mm² ${row.cable.material}`,
    row.currentA,
    row.voltageDropPercent,
    row.moduleWidth,
    source.t(`panel.status${row.status === 'ok' ? 'Ok' : row.status === 'warning' ? 'Warning' : 'Error'}`),
  ]);
}

function numericTotals(
  columns: readonly ReportColumn[],
  label: string,
  values: Readonly<Record<string, number | null>>,
): ReportCell[] {
  const cells: ReportCell[] = columns.map(() => '');
  cells[0] = label;

  for (const column of columns) {
    const value = values[column.key];
    if (value !== null && value !== undefined) {
      cells[columns.indexOf(column)] = value;
    }
  }

  return cells;
}

/**
 * Builds a report table from the current plan. The selected field keys are
 * normalized to the template order so a report always has a stable layout.
 */
export function buildReportTable(
  id: ReportId,
  source: ReportSource,
  fields?: readonly string[],
): ReportTable {
  const definition = getReportDefinition(id);
  const selected = new Set(
    normalizeReportFields(id, fields ?? definition.defaultFields),
  );
  const activeFields = definition.fields.filter((field) => selected.has(field.key));
  const columns: ReportColumn[] = activeFields.map((field) => ({
    key: field.key,
    label: source.t(field.labelKey),
    numeric: Boolean(field.numeric),
  }));
  const pick = (values: Record<string, ReportCell>): ReportCell[] =>
    activeFields.map((field) => values[field.key] ?? '');

  if (id === 'equipment') {
    const { rows, totalQuantity, totalCost } = equipmentRows(source);

    return {
      columns,
      rows: rows.map((row) => pick(mapRow(definition, row))),
      total:
        rows.length > 0
          ? numericTotals(columns, source.t('report.total'), {
              quantity: totalQuantity,
              totalCost:
                totalCost === null
                  ? null
                  : Math.round(totalCost * 100) / 100,
            })
          : undefined,
    };
  }

  if (id === 'cable-journal') {
    const rows = journalSourceRows(source);
    const totalLength = rows.reduce((sum, row) => sum + row.length, 0);

    return {
      columns,
      rows: rows.map((row) =>
        pick({
          address: row.address,
          wire: row.wire,
          terminal: row.terminal,
          circuit: row.circuit,
          name: row.name,
          phase: row.phase,
          breaker: row.breaker,
          rcd: row.rcd,
          cable: row.cable,
          length: row.length,
          devices: row.devices,
          routes: row.routes,
        }),
      ),
      total:
        rows.length > 0
          ? numericTotals(columns, source.t('report.total'), {
              length: Math.round(totalLength * 100) / 100,
            })
          : undefined,
    };
  }

  if (
    id === 'signaling-equipment' ||
    id === 'signaling-cable' ||
    id === 'ppkp-schedule' ||
    id === 'battery-report'
  ) {
    return buildSignalingReportTable(id, source, activeFields, pick, columns);
  }

  const rows = panelRows(source);
  const totalLoad = panelScheduleOf(source)?.rows.reduce(
    (sum, row) => sum + row.currentA,
    0,
  );

  return {
    columns,
    rows: rows.map((row) => pick(mapRow(definition, row))),
    total:
      rows.length > 0 && totalLoad !== undefined
        ? numericTotals(columns, source.t('report.total'), {
            load: Math.round(totalLoad * 10) / 10,
          })
        : undefined,
  };
}

function buildSignalingReportTable(
  id: ReportId,
  source: ReportSource,
  activeFields: readonly ReportFieldDefinition[],
  pick: (values: Record<string, ReportCell>) => ReportCell[],
  columns: ReportColumn[],
): ReportTable {
  const loops = source.signalingLoops ?? [];
  const takeoff = source.signaling ?? null;
  const points = source.points ?? source.drawing?.points ?? [];
  const loopById = new Map(loops.map((loop) => [loop.id, loop]));
  const materialById = new Map(
    (source.materials ?? []).map((material) => [material.id, material]),
  );

  if (id === 'signaling-equipment') {
    const groups = new Map<
      string,
      { loopId: string | null; productId: string | null; points: PublicPoint[] }
    >();
    for (const point of points) {
      const loopId = point.properties.loopId ?? null;
      if (!loopId) continue;
      const productId = point.properties.productId ?? null;
      const key = `${loopId}:${productId ?? point.properties.subtype ?? point.type}`;
      const group = groups.get(key);
      if (group) group.points.push(point);
      else groups.set(key, { loopId, productId, points: [point] });
    }

    const rows = [...groups.values()].map((group) => {
      const first = group.points[0]!;
      const product = deviceProduct(group.productId);
      const loop = group.loopId ? loopById.get(group.loopId) : null;
      const addresses = group.points
        .map((point) => point.properties.address)
        .filter((address): address is number => typeof address === 'number')
        .sort((a, b) => a - b);
      const result = takeoff?.loops.find((item) => item.id === group.loopId);
      const share = result
        ? group.points.length / Math.max(1, result.deviceCount)
        : 0;

      return pick({
        loop: loop?.code ?? '—',
        loopName: loop?.name ?? '—',
        system: loop ? source.t(`signaling.type.${loop.type}`) : '—',
        address: addresses.length > 0 ? addresses.join(', ') : '—',
        manufacturer: product?.manufacturer ?? '—',
        article: product?.article ?? first.properties.subtype ?? '—',
        name:
          product?.name ??
          source.t(
            `devices.subtype.${first.properties.subtype ?? first.type}`,
          ),
        quantity: group.points.length,
        unit: product?.unit ?? 'pcs',
        standby: Number(
          ((product?.currentStandbyA ?? 0) * group.points.length).toFixed(4),
        ),
        alarm: Number(
          ((product?.currentAlarmA ?? 0) * group.points.length).toFixed(4),
        ),
        notes: share > 0 ? `${Math.round(share * 100)}%` : '',
      });
    });

    const quantityIndex = activeFields.findIndex(
      (field) => field.key === 'quantity',
    );
    const quantity = rows.reduce(
      (sum, row) =>
        sum + (quantityIndex >= 0 ? Number(row[quantityIndex] ?? 0) : 0),
      0,
    );

    return {
      columns,
      rows,
      total:
        rows.length > 0
          ? numericTotals(columns, source.t('report.total'), { quantity })
          : undefined,
    };
  }

  if (id === 'signaling-cable') {
    const rows = (takeoff?.loops ?? []).map((result) => {
      const loop = loopById.get(result.id);
      const material = loop?.cableMaterialId
        ? materialById.get(loop.cableMaterialId)
        : null;

      return pick({
        loop: result.code,
        system: source.t(`signaling.type.${result.type}`),
        cable: material ? `${material.code} · ${material.name}` : '—',
        length: result.cableMeters,
        devices: result.deviceCount,
        addresses:
          result.addresses.length > 0 ? result.addresses.join(', ') : '—',
        status: source.t(`signaling.status.${result.status}`),
      });
    });

    return {
      columns,
      rows,
      total:
        rows.length > 0
          ? numericTotals(columns, source.t('report.total'), {
              length: takeoff?.totalCableMeters ?? 0,
              devices: takeoff?.totalDevices ?? 0,
            })
          : undefined,
    };
  }

  if (id === 'ppkp-schedule') {
    const rows = (takeoff?.loops ?? []).map((result) => {
      const loop = loopById.get(result.id);
      const used = result.addresses.length;
      const free = Math.max(0, (result.maxDevices ?? 0) - used);

      return pick({
        loop: result.code,
        system: source.t(`signaling.type.${result.type}`),
        topology: source.t(
          `signaling.topology.${loop?.topology ?? 'radial'}`,
        ),
        devices: result.deviceCount,
        used,
        free,
        standby: Number(result.standbyA.toFixed(4)),
        alarm: Number(result.alarmA.toFixed(4)),
        voltage: result.voltageV,
        drop: result.voltageDropPercent,
        status: source.t(`signaling.status.${result.status}`),
      });
    });

    return { columns, rows };
  }

  const battery = takeoff?.battery;
  const rows: ReportCell[][] = [
    pick({
      item: source.t('report.battery.standbyCurrent'),
      formula: `I_standby = ${(takeoff?.standbyA ?? 0).toFixed(4)} A`,
      value: Number((takeoff?.standbyA ?? 0).toFixed(4)),
      unit: 'A',
      note: 'EN 54-4',
    }),
    pick({
      item: source.t('report.battery.alarmCurrent'),
      formula: `I_alarm = ${(takeoff?.alarmA ?? 0).toFixed(4)} A`,
      value: Number((takeoff?.alarmA ?? 0).toFixed(4)),
      unit: 'A',
      note: 'EN 54-4',
    }),
    pick({
      item: source.t('report.battery.required'),
      formula: `C = (I_standby × ${battery?.standbyHours ?? 24} + I_alarm × ${((battery?.alarmMinutes ?? 5) / 60).toFixed(2)}) × 1.25`,
      value: battery?.requiredAh ?? 0,
      unit: 'Ah',
      note: 'EN 54-4, п. 6.3; ДБН В.2.5-56:2014, п. 6.5',
    }),
    pick({
      item: source.t('report.battery.recommended'),
      formula: `${battery?.recommendedAh ?? 0} Ah × ${battery?.batteries ?? 1}`,
      value: battery?.recommendedAh ?? 0,
      unit: 'Ah',
      note: source.t('report.battery.reserve'),
    }),
  ];

  return { columns, rows };
}


function mapRow(
  definition: ReportDefinition,
  values: readonly ReportCell[],
): Record<string, ReportCell> {
  return Object.fromEntries(
    definition.fields.map((field, index) => [field.key, values[index] ?? '']),
  );
}

function csvCell(value: ReportCell): string {
  const text = String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Excel-friendly CSV with a UTF-8 BOM and semicolon separators. */
export function buildReportCsv(table: ReportTable): string {
  const header = table.columns.map((column) => column.label);
  const rows = table.rows.map((row) => row.map(csvCell).join(';'));
  const total = table.total ? [table.total.map(csvCell).join(';')] : [];

  return `\uFEFF${[header.map(csvCell).join(';'), ...rows, ...total].join('\r\n')}`;
}

function displayWidth(value: ReportCell): number {
  return String(value).length;
}

/** Converts a report into a worksheet with sensible column widths. */
export function reportToSheet(table: ReportTable, name: string): XlsxSheet {
  const sample = table.rows.slice(0, 100);

  return {
    name,
    columns: table.columns.map((column, index) => {
      const widest = Math.max(
        column.label.length,
        ...sample.map((row) => displayWidth(row[index] ?? '')),
        table.total ? displayWidth(table.total[index] ?? '') : 0,
      );

      return {
        label: column.label,
        width: Math.min(48, Math.max(10, widest + 2)),
      };
    }),
    rows: table.rows,
    total: table.total,
  };
}

export interface ReportSheetDefinition {
  id: ReportId;
  table: ReportTable;
  /** Worksheet tab name; falls back to a readable English default. */
  name?: string;
}

const DEFAULT_SHEET_NAMES: Record<ReportId, string> = {
  equipment: 'Equipment',
  'cable-journal': 'Cable journal',
  'panel-schedule': 'Panel schedule',
  'signaling-equipment': 'Signaling equipment',
  'signaling-cable': 'Signaling cables',
  'ppkp-schedule': 'Fire panel schedule',
  'battery-report': 'Battery calculation',
};

/** Builds a multi-sheet workbook with one sheet per requested report. */
export function buildReportsWorkbook(
  reports: readonly ReportSheetDefinition[],
  meta: { title?: string; createdAt?: Date } = {},
): Uint8Array {
  return buildXlsx(
    reports.map((report) =>
      reportToSheet(
        report.table,
        report.name ?? DEFAULT_SHEET_NAMES[report.id],
      ),
    ),
    { title: meta.title, creator: 'DrawMyPlace', createdAt: meta.createdAt },
  );
}

export function reportFileName(
  projectName: string,
  reportName: string,
  extension: string,
): string {
  const safe = `${projectName}-${reportName}-${new Date()
    .toISOString()
    .slice(0, 10)}`
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '');

  return `${safe || 'report'}.${extension}`;
}

export function reportTableHasRows(table: ReportTable): boolean {
  return table.rows.length > 0;
}
