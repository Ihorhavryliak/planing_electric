import type { ElectricalPointType, PlanDrawing } from '@drawmyplace/contracts';

export interface PlanSvgOptions {
  title?: string;
  subtitle?: string;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const COLORS: Record<ElectricalPointType, string> = {
  socket: '#0284c7',
  switch: '#7c3aed',
  light: '#ca8a04',
  panel: '#e11d48',
  junction: '#059669',
  custom: '#64748b',
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function num(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 100) / 100) : '0';
}

function collectBounds(drawing: PlanDrawing): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const include = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const wall of drawing.walls) {
    for (const point of wall.geometry) include(point.x, point.y);
  }
  for (const room of drawing.rooms) {
    for (const point of room.boundary) include(point.x, point.y);
  }
  for (const route of drawing.routes) {
    for (const point of route.geometry) include(point.x, point.y);
  }
  for (const point of drawing.points) include(point.x, point.y);
  for (const dimension of drawing.dimensions) {
    include(dimension.pointA.x, dimension.pointA.y);
    include(dimension.pointB.x, dimension.pointB.y);
  }

  if (!Number.isFinite(minX)) return null;

  return { minX, minY, maxX, maxY };
}

function polylineLength(points: readonly { x: number; y: number }[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    if (a && b) total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return total;
}

function pointAtOffset(
  points: readonly { x: number; y: number }[],
  offset: number,
): { x: number; y: number; angle: number } | null {
  if (points.length < 2) return null;

  let remaining = Math.max(0, offset);

  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];

    if (!a || !b) continue;

    const length = Math.hypot(b.x - a.x, b.y - a.y);

    if (length >= remaining) {
      const ratio = length === 0 ? 0 : remaining / length;
      return {
        x: a.x + (b.x - a.x) * ratio,
        y: a.y + (b.y - a.y) * ratio,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }

    remaining -= length;
  }

  const last = points[points.length - 1];
  const previous = points[points.length - 2];

  return last
    ? {
        x: last.x,
        y: last.y,
        angle: previous
          ? Math.atan2(last.y - previous.y, last.x - previous.x)
          : 0,
      }
    : null;
}

function pathData(
  points: readonly { x: number; y: number }[],
): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${num(point.x)} ${num(point.y)}`)
    .join(' ');
}

function midpoint(
  points: readonly { x: number; y: number }[],
): { x: number; y: number } | null {
  if (points.length === 0) return null;

  const total = polylineLength(points);
  if (total === 0) {
    const only = points[0];
    return only ? { x: only.x, y: only.y } : null;
  }

  const target = pointAtOffset(points, total / 2);
  return target ? { x: target.x, y: target.y } : null;
}

function pointGlyph(type: ElectricalPointType, radius: number): string {
  const r = radius;

  switch (type) {
    case 'socket':
      return `<line x1="0" y1="${num(-r * 0.65)}" x2="0" y2="${num(r * 0.65)}" />`;
    case 'switch':
      return `<line x1="${num(-r * 0.55)}" y1="${num(r * 0.45)}" x2="${num(r * 0.6)}" y2="${num(-r * 0.65)}" />`;
    case 'light':
      return `<line x1="${num(-r * 0.5)}" y1="${num(-r * 0.5)}" x2="${num(r * 0.5)}" y2="${num(r * 0.5)}" /><line x1="${num(-r * 0.5)}" y1="${num(r * 0.5)}" x2="${num(r * 0.5)}" y2="${num(-r * 0.5)}" />`;
    case 'panel':
      return `<rect x="${num(-r * 0.85)}" y="${num(-r * 0.55)}" width="${num(r * 1.7)}" height="${num(r * 1.1)}" fill="none" /><line x1="${num(-r * 0.6)}" y1="0" x2="${num(r * 0.6)}" y2="0" />`;
    case 'junction':
      return `<circle cx="0" cy="0" r="${num(r * 0.32)}" fill="currentColor" stroke="none" />`;
    case 'custom':
      return `<rect x="${num(-r * 0.45)}" y="${num(-r * 0.45)}" width="${num(r * 0.9)}" height="${num(r * 0.9)}" fill="none" />`;
  }
}

function circuitLabel(
  code: string,
  color: string,
  at: { x: number; y: number },
  fontSize: number,
): string {
  const width = Math.max(fontSize * 2.2, code.length * fontSize * 0.62 + fontSize * 1.3);
  const height = fontSize * 1.35;
  return `<g><rect x="${num(at.x - width / 2)}" y="${num(at.y - height - fontSize * 0.6)}" width="${num(width)}" height="${num(height)}" fill="white" stroke="${color}" stroke-width="1" /><text x="${num(at.x)}" y="${num(at.y - height / 2 - fontSize * 0.6)}" font-size="${num(fontSize)}" font-weight="600" text-anchor="middle" dominant-baseline="middle" fill="#0f172a">${escapeXml(code)}</text></g>`;
}

/**
 * Vector floor plan for printing and sharing. Uses world coordinates directly
 * and a white page background; the underlay image is intentionally omitted.
 */
export function buildPlanSvg(
  drawing: PlanDrawing,
  circuits: readonly { id: string; color: string }[] = [],
  options: PlanSvgOptions = {},
): string {
  const bounds = collectBounds(drawing);
  const width = bounds ? Math.max(bounds.maxX - bounds.minX, 100) : 1000;
  const height = bounds ? Math.max(bounds.maxY - bounds.minY, 100) : 700;
  const pad = Math.max(width, height) * 0.05;
  const minX = (bounds?.minX ?? 0) - pad;
  const minY = (bounds?.minY ?? 0) - pad;
  const viewWidth = width + pad * 2;
  const viewHeight = height + pad * 2;
  const fontSize = Math.min(Math.max(Math.min(width, height) * 0.018, 7), 40);
  const pointRadius = Math.min(Math.max(Math.min(width, height) * 0.012, 3), 28);
  const wallStroke = Math.min(Math.max(Math.min(width, height) * 0.004, 1.2), 20);
  const circuitColor = new Map(circuits.map((circuit) => [circuit.id, circuit.color]));
  const visiblePoints = new Set(drawing.points.map((point) => point.id));
  const dimensions = drawing.dimensions
    .map((dimension) => {
      const dx = dimension.pointB.x - dimension.pointA.x;
      const dy = dimension.pointB.y - dimension.pointA.y;
      const length = Math.hypot(dx, dy);
      if (length === 0) return '';
      const nx = -dy / length;
      const ny = dx / length;
      const offset = dimension.offset;
      const a = {
        x: dimension.pointA.x + nx * offset,
        y: dimension.pointA.y + ny * offset,
      };
      const b = {
        x: dimension.pointB.x + nx * offset,
        y: dimension.pointB.y + ny * offset,
      };
      const label =
        dimension.label ??
        (drawing.calibration
          ? `${num(length * drawing.calibration.metersPerUnit)} m`
          : `${num(length)} u`);
      return `<g stroke="#475569" stroke-width="${num(fontSize * 0.12)}" fill="#334155"><line x1="${num(dimension.pointA.x)}" y1="${num(dimension.pointA.y)}" x2="${num(a.x)}" y2="${num(a.y)}" /><line x1="${num(dimension.pointB.x)}" y1="${num(dimension.pointB.y)}" x2="${num(b.x)}" y2="${num(b.y)}" /><line x1="${num(a.x)}" y1="${num(a.y)}" x2="${num(b.x)}" y2="${num(b.y)}" /><text x="${num((a.x + b.x) / 2)}" y="${num((a.y + b.y) / 2 - fontSize * 0.25)}" font-size="${num(fontSize)}" text-anchor="middle" stroke="none">${escapeXml(label)}</text></g>`;
    })
    .join('');

  const rooms = drawing.rooms
    .map((room) => {
      const points = room.boundary
        .map((point) => `${num(point.x)},${num(point.y)}`)
        .join(' ');
      const center = room.boundary.reduce(
        (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
        { x: 0, y: 0 },
      );
      const count = Math.max(1, room.boundary.length);
      return `<g><polygon points="${points}" fill="#dbeafe" fill-opacity="0.55" stroke="#93c5fd" stroke-width="${num(fontSize * 0.14)}" stroke-dasharray="${num(fontSize * 0.5)} ${num(fontSize * 0.3)}" /><text x="${num(center.x / count)}" y="${num(center.y / count)}" font-size="${num(fontSize * 1.1)}" font-weight="600" text-anchor="middle" dominant-baseline="middle" fill="#1e3a8a">${escapeXml(room.name)}</text></g>`;
    })
    .join('');

  const walls = drawing.walls
    .map(
      (wall) =>
        `<path d="${pathData(wall.geometry)}" fill="none" stroke="#0f172a" stroke-width="${num(Math.max(wallStroke, wall.thickness ?? wallStroke))}" />`,
    )
    .join('');

  const openings = drawing.openings
    .map((opening) => {
      const wall = drawing.walls.find((item) => item.id === opening.wallId);
      if (!wall) return '';
      const center = pointAtOffset(wall.geometry, opening.offset + opening.width / 2);
      if (!center) return '';
      const angle = (center.angle * 180) / Math.PI;
      const gap = opening.width;
      const half = gap / 2;
      const door = opening.type === 'door';
      return `<g transform="translate(${num(center.x)} ${num(center.y)}) rotate(${num(angle)})"><line x1="${num(-half)}" y1="0" x2="${num(half)}" y2="0" stroke="white" stroke-width="${num(Math.max(wallStroke * 2.8, (wall.thickness ?? wallStroke) * 1.6))}" /><line x1="${num(-half)}" y1="0" x2="${num(half)}" y2="0" stroke="${door ? '#0f172a' : '#2563eb'}" stroke-width="${num(fontSize * 0.12)}" stroke-dasharray="${door ? 'none' : `${num(fontSize * 0.35)} ${num(fontSize * 0.25)}`}" />${door ? `<line x1="${num(-half)}" y1="0" x2="${num(-half)}" y2="${num(-gap * 0.8)}" stroke="#0f172a" stroke-width="${num(fontSize * 0.12)}" />` : `<line x1="0" y1="${num(-fontSize * 0.3)}" x2="0" y2="${num(fontSize * 0.3)}" stroke="#2563eb" stroke-width="${num(fontSize * 0.12)}" />`}</g>`;
    })
    .join('');

  const routes = drawing.routes
    .map((route) => {
      const color = route.circuitId
        ? (circuitColor.get(route.circuitId) ?? '#ea580c')
        : '#ea580c';
      const chase = route.settings.mounting === 'chase';
      const base = `<path d="${pathData(route.geometry)}" fill="none" stroke="${color}" stroke-width="${num(fontSize * (chase ? 0.32 : 0.22))}" ${chase ? `stroke-dasharray="${num(fontSize * 0.7)} ${num(fontSize * 0.45)}"` : ''} stroke-linecap="round" stroke-linejoin="round" />`;
      const start = route.geometry[0];
      const end = route.geometry[route.geometry.length - 1];
      const pins = [
        route.startPointId && start
          ? `<circle cx="${num(start.x)}" cy="${num(start.y)}" r="${num(fontSize * 0.34)}" fill="#020617" stroke="#38bdf8" stroke-width="${num(fontSize * 0.1)}" />`
          : '',
        route.endPointId && end
          ? `<circle cx="${num(end.x)}" cy="${num(end.y)}" r="${num(fontSize * 0.34)}" fill="#020617" stroke="#34d399" stroke-width="${num(fontSize * 0.1)}" />`
          : '',
      ].join('');
      if (!route.circuitId) return base + pins;
      const mid = midpoint(route.geometry);
      return mid
        ? base + pins + circuitLabel(route.circuitId, color, mid, fontSize)
        : base + pins;
    })
    .join('');

  const points = drawing.points
    .map((point) => {
      if (!visiblePoints.has(point.id)) return '';
      const color = COLORS[point.type];
      const label = point.label?.trim();
      return `<g transform="translate(${num(point.x)} ${num(point.y)})" color="${color}" stroke="${color}" stroke-width="${num(pointRadius * 0.18)}" fill="none"><circle r="${num(pointRadius)}" fill="white" stroke="${color}" stroke-width="${num(pointRadius * 0.22)}" />${pointGlyph(point.type, pointRadius)}${label ? `<text y="${num(pointRadius * 1.9)}" font-size="${num(fontSize)}" text-anchor="middle" fill="#334155" stroke="none">${escapeXml(label)}</text>` : ''}</g>`;
    })
    .join('');

  const title = options.title ?? 'DrawMyPlace plan';
  const subtitle = options.subtitle ?? '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${num(minX)} ${num(minY)} ${num(viewWidth)} ${num(viewHeight)}" width="${num(viewWidth)}" height="${num(viewHeight)}" font-family="Inter, ui-sans-serif, system-ui, sans-serif">
  <rect x="${num(minX)}" y="${num(minY)}" width="${num(viewWidth)}" height="${num(viewHeight)}" fill="white" />
  <g stroke-linecap="round" stroke-linejoin="round">
    ${rooms}
    ${dimensions}
    ${walls}
    ${openings}
    ${routes}
    ${points}
  </g>
  <g text-anchor="end" fill="#64748b" font-size="${num(fontSize * 0.9)}">
    <text x="${num(minX + viewWidth - pad * 0.5)}" y="${num(minY + pad * 0.9)}" font-weight="600" fill="#0f172a">${escapeXml(title)}</text>
    ${subtitle ? `<text x="${num(minX + viewWidth - pad * 0.5)}" y="${num(minY + pad * 0.9 + fontSize * 1.35)}">${escapeXml(subtitle)}</text>` : ''}
  </g>
</svg>`;
}

/**
 * Single-line electrical schematic grouped by circuit, with devices and cable
 * lengths. Complements the floor plan when printed as a project document.
 */
export function buildSchematicSvg(
  drawing: PlanDrawing,
  cableLengths: Readonly<Record<string, number>> = {},
  options: PlanSvgOptions = {},
): string {
  // Circuits live on the plan settings; codes are enough for a schematic.
  const allCircuits = [
    ...new Set([
      ...drawing.routes.map((route) => route.circuitId),
      ...drawing.points.map((point) => point.properties.circuitId ?? null),
    ]),
  ]
    .filter((id): id is string => Boolean(id))
    .sort();
  const width = 1200;
  const rowHeight = 96;
  const headerHeight = 96;
  const journeyHeight = Math.max(
    420,
    headerHeight + (allCircuits.length + 1) * rowHeight + 80,
  );
  const font = 14;
  const cableByCircuit = new Map<string, number>(
    Object.entries(cableLengths),
  );

  const pointsByCircuit = new Map<string, typeof drawing.points>();
  const unassigned = drawing.points.filter(
    (point) => !point.properties.circuitId,
  );

  for (const point of drawing.points) {
    const code = point.properties.circuitId;
    if (!code) continue;
    const list = pointsByCircuit.get(code) ?? [];
    list.push(point);
    pointsByCircuit.set(code, list);
  }

  const rows = allCircuits
    .map((code, index) => {
      const y = headerHeight + index * rowHeight;
      const points = pointsByCircuit.get(code) ?? [];
      const routes = drawing.routes.filter((route) => route.circuitId === code);
      const length = cableByCircuit.get(code) ?? 0;
      const shown = points.slice(0, 7);
      const devices = shown
        .map(
          (point, deviceIndex) =>
            `<g transform="translate(${220 + deviceIndex * 120} ${num(y)})"><line x1="0" y1="0" x2="0" y2="-18" stroke="#94a3b8" stroke-width="1.5" /><circle cy="-22" r="9" fill="white" stroke="#0f172a" stroke-width="1.5" /><text y="16" font-size="10" text-anchor="middle" fill="#475569">${escapeXml((point.label ?? point.type).slice(0, 14))}</text></g>`,
        )
        .join('');
      const more = points.length > shown.length
        ? `<text x="${num(220 + shown.length * 120)}" y="${num(y + 4)}" font-size="11" fill="#64748b">+${points.length - shown.length}</text>`
        : '';

      return `<g>
  <rect x="40" y="${num(y - 26)}" width="120" height="52" rx="6" fill="#0f172a" />
  <text x="100" y="${num(y + 5)}" font-size="16" font-weight="700" text-anchor="middle" fill="white">${escapeXml(code)}</text>
  <line x1="160" y1="${num(y)}" x2="1080" y2="${num(y)}" stroke="#cbd5e1" stroke-width="2" />
  ${devices}${more}
  <text x="1060" y="${num(y + 4)}" font-size="12" text-anchor="end" fill="#475569">${routes.length} routes · ${num(length)} m</text>
</g>`;
    })
    .join('');

  const unassignedRow =
    unassigned.length > 0
      ? `<g>
  <rect x="40" y="${num(headerHeight + allCircuits.length * rowHeight - 26)}" width="120" height="52" rx="6" fill="#e2e8f0" />
  <text x="100" y="${num(headerHeight + allCircuits.length * rowHeight + 5)}" font-size="14" font-weight="700" text-anchor="middle" fill="#334155">N/A</text>
  <line x1="160" y1="${num(headerHeight + allCircuits.length * rowHeight)}" x2="1080" y2="${num(headerHeight + allCircuits.length * rowHeight)}" stroke="#e2e8f0" stroke-width="2" />
  <text x="180" y="${num(headerHeight + allCircuits.length * rowHeight + 4)}" font-size="12" fill="#64748b">${unassigned.length} devices without a circuit</text>
</g>`
      : '';

  const title = options.title ?? 'Electrical schematic';
  const subtitle = options.subtitle ?? '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${journeyHeight}" width="${width}" height="${journeyHeight}" font-family="Inter, ui-sans-serif, system-ui, sans-serif">
  <rect width="${width}" height="${journeyHeight}" fill="white" />
  <text x="40" y="42" font-size="${font}" fill="#64748b">${escapeXml(subtitle)}</text>
  <text x="40" y="72" font-size="24" font-weight="700" fill="#0f172a">${escapeXml(title)}</text>
  ${rows}
  ${unassignedRow}
</svg>`;
}
