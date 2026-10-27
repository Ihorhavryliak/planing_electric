import type { PublicPoint, SignalingLoop } from '@drawmyplace/contracts';
import type { SignalingTakeoff } from '@drawmyplace/calculations';

export interface SignalingSchematicInput {
  loops: readonly SignalingLoop[];
  points: readonly PublicPoint[];
  takeoff: SignalingTakeoff | null;
  title?: string;
  subtitle?: string;
  labels?: {
    panel?: string;
    devices?: string;
    address?: string;
    free?: string;
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Structural signaling schematic: control panel on the left, one column per
 * loop with device glyphs and addresses. Each loop segment lists its cable,
 * device count and free address capacity.
 */
export function buildSignalingSchematicSvg(
  input: SignalingSchematicInput,
): string {
  const labels = {
    panel: 'Fire panel',
    devices: 'devices',
    address: 'Address',
    free: 'free',
    ...input.labels,
  };
  const loops = input.loops;
  const points = input.points;
  const takeoff = input.takeoff;
  const loopWidth = 270;
  const left = 300;
  const top = 190;
  const deviceRow = 34;
  const rows = loops.map((loop) => {
    const result = takeoff?.loops.find((item) => item.id === loop.id);
    const devices = points.filter(
      (point) => point.properties.loopId === loop.id,
    );
    return { loop, result, devices };
  });
  const tallest = Math.max(
    1,
    ...rows.map((row) => Math.ceil(row.devices.length)),
  );
  const width = Math.max(900, left + rows.length * loopWidth + 60);
  const height = Math.max(520, top + tallest * deviceRow + 180);
  const panelX = 60;
  const panelY = top + 40;

  const loopGroups = rows
    .map((row, index) => {
      const x = left + index * loopWidth;
      const color = row.loop.color;
      const result = row.result;
      const status = result?.status ?? 'ok';
      const statusColor =
        status === 'error'
          ? '#dc2626'
          : status === 'warning'
            ? '#d97706'
            : '#059669';
      const devices = row.devices
        .map((point, deviceIndex) => {
          const y = top + 74 + deviceIndex * deviceRow;
          const subtype = point.properties.subtype ?? '';
          const isSiren =
            subtype.includes('siren') ||
            subtype === 'strobe' ||
            subtype === 'voice-alarm';
          const isPanel = subtype === 'fire-panel';
          const glyph = isSiren
            ? `<path d="M ${x + 14} ${y - 7} L ${x + 28} ${y - 12} L ${x + 28} ${y + 12} L ${x + 14} ${y + 7} Z" fill="none" stroke="${color}" stroke-width="1.6"/>`
            : isPanel
              ? `<rect x="${x + 10}" y="${y - 9}" width="20" height="18" rx="2" fill="none" stroke="${color}" stroke-width="1.6"/>`
              : `<circle cx="${x + 20}" cy="${y}" r="9" fill="none" stroke="${color}" stroke-width="1.6"/><circle cx="${x + 20}" cy="${y}" r="2" fill="${color}"/>`;
          const address =
            typeof point.properties.address === 'number'
              ? `${point.properties.address}`
              : '—';
          const name = point.label ?? subtype ?? point.type;

          return `<g>
    <line x1="${x + 28}" y1="${y}" x2="${x + 52}" y2="${y}" stroke="#cbd5e1" stroke-width="1"/>
    ${glyph}
    <text x="${x + 58}" y="${y - 2}" font-size="10" fill="#0f172a">${escapeXml(name)}</text>
    <text x="${x + 58}" y="${y + 9}" font-size="9" fill="#64748b">${labels.address} ${escapeXml(address)}</text>
  </g>`;
        })
        .join('\n');

      return `<g>
  <line x1="${panelX + 220}" y1="${panelY + 26}" x2="${x + 10}" y2="${panelY + 26}" stroke="#94a3b8" stroke-width="1.4"/>
  <line x1="${x + 10}" y1="${panelY + 26}" x2="${x + 10}" y2="${top}" stroke="#94a3b8" stroke-width="1.4"/>
  <rect x="${x}" y="${top}" width="${loopWidth - 30}" height="${Math.max(120, tallest * deviceRow + 110)}" rx="10" fill="#f8fafc" stroke="#dbe3ec"/>
  <rect x="${x}" y="${top}" width="${loopWidth - 30}" height="34" rx="10" fill="${color}" opacity="0.12"/>
  <text x="${x + 14}" y="${top + 21}" font-size="12" font-weight="700" fill="${color}">${escapeXml(row.loop.code)}</text>
  <text x="${x + 58}" y="${top + 21}" font-size="10" fill="#334155">${escapeXml(row.loop.name)}</text>
  <text x="${x + 14}" y="${top + 52}" font-size="9" fill="#64748b">${escapeXml(row.loop.type)} · ${row.devices.length} ${labels.devices} · ${result?.cableMeters ?? 0} m</text>
  <text x="${x + 14}" y="${top + 66}" font-size="9" fill="#64748b">${result?.addresses.length ?? 0} / ${result?.maxDevices ?? 0} · ${status}</text>
  <rect x="${x + loopWidth - 60}" y="${top + 14}" width="8" height="8" rx="4" fill="${statusColor}"/>
  ${devices}
</g>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="IBM Plex Sans, Arial, sans-serif">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  <text x="40" y="48" font-size="20" font-weight="700" fill="#0f172a">${escapeXml(input.title ?? 'Signaling schematic')}</text>
  <text x="40" y="70" font-size="11" fill="#64748b">${escapeXml(input.subtitle ?? '')}</text>
  <g>
    <rect x="${panelX}" y="${panelY}" width="220" height="72" rx="10" fill="#eef4ff" stroke="#2f6bd8" stroke-width="1.6"/>
    <text x="${panelX + 16}" y="${panelY + 28}" font-size="13" font-weight="700" fill="#1e3a8a">${escapeXml(labels.panel)}</text>
    <text x="${panelX + 16}" y="${panelY + 46}" font-size="10" fill="#475569">${loops.length} loops · ${takeoff?.totalDevices ?? points.filter((point) => point.properties.loopId).length} ${labels.devices}</text>
    <text x="${panelX + 16}" y="${panelY + 61}" font-size="9" fill="#64748b">${takeoff?.battery.recommendedAh ?? 0} Ah · ${(takeoff?.standbyA ?? 0).toFixed(3)} A standby</text>
  </g>
  ${loopGroups}
  <text x="40" y="${height - 28}" font-size="9" fill="#94a3b8">DrawMyPlace · ${new Date().toISOString().slice(0, 10)}</text>
</svg>`;
}
