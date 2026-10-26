import type { Circuit, PlanDrawing } from '@drawmyplace/contracts';
import type { ElectricalPlanResult } from '@drawmyplace/calculations';
import { buildCircuitNumbering } from './circuit-numbering';
import type { PlanSvgOptions } from './svg-export';

export interface SchematicSvgOptions extends PlanSvgOptions {
  circuits?: readonly Circuit[];
  electrical?: ElectricalPlanResult | null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function num(value: number): string {
  return Number.isFinite(value)
    ? String(Math.round(value * 100) / 100)
    : '0';
}

/**
 * Full single-line schematic: incoming supply, main breaker, board busbar,
 * every circuit with its automatic address, breaker/RCD rating, wire tag,
 * cable section and connected devices. It is generated from the current plan
 * and electrical calculation, so plan edits are reflected on the next export.
 */
export function buildSchematicSvg(
  drawing: PlanDrawing,
  cableLengths: Readonly<Record<string, number>> = {},
  options: SchematicSvgOptions = {},
): string {
  const allCircuits = [
    ...new Set([
      ...drawing.routes.map((route) => route.circuitId),
      ...drawing.points.map((point) => point.properties.circuitId ?? null),
    ]),
  ]
    .filter((id): id is string => Boolean(id))
    .sort();
  const circuitDefinitions =
    options.circuits && options.circuits.length > 0
      ? options.circuits.filter((circuit) => allCircuits.includes(circuit.id))
      : allCircuits.map((id) => ({ id, name: id, color: '#f59e0b' }));
  const numbering = buildCircuitNumbering(
    circuitDefinitions,
    options.electrical,
  );
  const electricalByCircuit = new Map(
    (options.electrical?.circuits ?? []).map((circuit) => [circuit.id, circuit]),
  );
  const board = options.electrical?.settings.board ?? null;
  const width = 1200;
  const rowHeight = 104;
  const headerHeight = board ? 210 : 110;
  const journeyHeight = Math.max(
    500,
    headerHeight + (allCircuits.length + 1) * rowHeight + 80,
  );

  const cableByCircuit = new Map<string, number>(
    Object.entries(cableLengths),
  );
  const pointsByCircuit = new Map<string, typeof drawing.points>();

  for (const point of drawing.points) {
    const code = point.properties.circuitId;
    if (!code) continue;
    const list = pointsByCircuit.get(code) ?? [];
    list.push(point);
    pointsByCircuit.set(code, list);
  }

  const unassigned = drawing.points.filter(
    (point) => !point.properties.circuitId,
  );

  const intake = board
    ? `<g>
  <text x="600" y="104" font-size="11" text-anchor="middle" fill="#64748b">INCOMING SUPPLY</text>
  <line x1="600" y1="110" x2="600" y2="140" stroke="#0f172a" stroke-width="2" />
  <rect x="548" y="140" width="104" height="42" rx="6" fill="white" stroke="#0f172a" stroke-width="2" />
  <text x="600" y="158" font-size="12" font-weight="700" text-anchor="middle" fill="#0f172a">${escapeXml(
    numbering.boardTag,
  )}</text>
  <text x="600" y="173" font-size="11" text-anchor="middle" fill="#475569">${escapeXml(
    `${board.mainBreaker.ratingA} A ${board.mainBreaker.curve} · ${board.mainBreaker.poles}P`,
  )}</text>
  <line x1="600" y1="182" x2="600" y2="196" stroke="#0f172a" stroke-width="2" />
  <text x="612" y="198" font-size="12" fill="#0f172a">${escapeXml(
    board.name,
  )}${board.location ? ` · ${escapeXml(board.location)}` : ''}</text>
  <line x1="40" y1="200" x2="1160" y2="200" stroke="#0f172a" stroke-width="2" />
</g>`
    : '';

  const rows = allCircuits
    .map((code, index) => {
      const y = headerHeight + index * rowHeight;
      const number = numbering.circuits[code];
      const electrical = electricalByCircuit.get(code);
      const points = pointsByCircuit.get(code) ?? [];
      const routes = drawing.routes.filter((route) => route.circuitId === code);
      const length = cableByCircuit.get(code) ?? 0;
      const configured = circuitDefinitions.find(
        (circuit) => circuit.id === code,
      );
      const name = configured?.name ?? code;
      const address = number?.address ?? `Q1-${index + 1}L1`;
      const breakerTag = number?.breakerTag ?? `QF${index + 1}`;
      const wireTag = number?.wireTag ?? `W${index + 1}`;
      const terminalTag = number?.terminalTag ?? `X1:${index + 1}`;
      const breaker = electrical?.breaker;
      const rcd = electrical?.rcd;
      const cable = electrical?.cable;
      const protection = breaker
        ? `${breaker.ratingA} A ${breaker.curve} · ${breaker.poles}P`
        : '—';
      const rcdLabel = rcd
        ? `${rcd.ratingA} A / ${rcd.sensitivityMa} mA`
        : 'no RCD';
      const cableLabel = cable
        ? `${cable.sectionMm2} mm² ${cable.material}`
        : '—';
      const shown = points.slice(0, 6);
      const devices = shown
        .map(
          (point, deviceIndex) =>
            `<g transform="translate(${360 + deviceIndex * 118} ${num(y)})">
              <line x1="0" y1="0" x2="0" y2="-18" stroke="#94a3b8" stroke-width="1.5" />
              <circle cy="-22" r="9" fill="white" stroke="#0f172a" stroke-width="1.5" />
              <text y="16" font-size="10" text-anchor="middle" fill="#475569">${escapeXml(
                (point.label ?? point.type).slice(0, 14),
              )}</text>
            </g>`,
        )
        .join('');
      const more =
        points.length > shown.length
          ? `<text x="${num(360 + shown.length * 118)}" y="${num(y + 4)}" font-size="11" fill="#64748b">+${points.length - shown.length}</text>`
          : '';

      return `<g>
  <line x1="40" y1="${num(y)}" x2="1160" y2="${num(y)}" stroke="#e2e8f0" stroke-width="1" />
  <rect x="40" y="${num(y - 32)}" width="150" height="64" rx="6" fill="#0f172a" />
  <text x="54" y="${num(y - 12)}" font-size="12" font-weight="700" fill="white">${escapeXml(
    address,
  )}</text>
  <text x="54" y="${num(y + 5)}" font-size="11" fill="#cbd5e1">${escapeXml(
    name.slice(0, 18),
  )}</text>
  <text x="54" y="${num(y + 22)}" font-size="10" fill="#94a3b8">${escapeXml(
    terminalTag,
  )}</text>
  <line x1="190" y1="${num(y)}" x2="230" y2="${num(y)}" stroke="#0f172a" stroke-width="2" />
  <rect x="230" y="${num(y - 20)}" width="62" height="40" rx="4" fill="white" stroke="#0f172a" stroke-width="2" />
  <text x="261" y="${num(y - 5)}" font-size="10" font-weight="700" text-anchor="middle" fill="#0f172a">${escapeXml(
    breakerTag,
  )}</text>
  <text x="261" y="${num(y + 9)}" font-size="9" text-anchor="middle" fill="#475569">${escapeXml(
    protection,
  )}</text>
  <line x1="292" y1="${num(y)}" x2="1160" y2="${num(y)}" stroke="#cbd5e1" stroke-width="2" />
  ${devices}${more}
  <text x="1148" y="${num(y - 8)}" font-size="11" text-anchor="end" fill="#334155">${escapeXml(
    `${wireTag} · ${cableLabel}`,
  )}</text>
  <text x="1148" y="${num(y + 8)}" font-size="10" text-anchor="end" fill="#64748b">${escapeXml(
    `${rcdLabel} · ${num(length)} m · ${routes.length} routes`,
  )}</text>
</g>`;
    })
    .join('');

  const unassignedRow =
    unassigned.length > 0
      ? `<g>
  <rect x="40" y="${num(headerHeight + allCircuits.length * rowHeight - 26)}" width="150" height="52" rx="6" fill="#e2e8f0" />
  <text x="115" y="${num(headerHeight + allCircuits.length * rowHeight + 5)}" font-size="13" font-weight="700" text-anchor="middle" fill="#334155">N/A</text>
  <line x1="190" y1="${num(headerHeight + allCircuits.length * rowHeight)}" x2="1160" y2="${num(headerHeight + allCircuits.length * rowHeight)}" stroke="#e2e8f0" stroke-width="2" />
  <text x="210" y="${num(headerHeight + allCircuits.length * rowHeight + 4)}" font-size="12" fill="#64748b">${unassigned.length} devices without a circuit</text>
</g>`
      : '';

  const title = options.title ?? 'Electrical schematic';
  const subtitle = options.subtitle ?? '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${journeyHeight}" width="${width}" height="${journeyHeight}" font-family="Inter, ui-sans-serif, system-ui, sans-serif">
  <rect width="${width}" height="${journeyHeight}" fill="white" />
  <text x="40" y="42" font-size="14" fill="#64748b">${escapeXml(subtitle)}</text>
  <text x="40" y="72" font-size="24" font-weight="700" fill="#0f172a">${escapeXml(title)}</text>
  ${intake}
  ${rows}
  ${unassignedRow}
</svg>`;
}
