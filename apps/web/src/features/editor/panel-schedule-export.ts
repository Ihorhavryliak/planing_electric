import type { PanelSchedule } from '@drawmyplace/calculations';

export interface PanelScheduleExportLabels {
  way: string;
  circuit: string;
  name: string;
  phase: string;
  protection: string;
  rcd: string;
  cable: string;
  load: string;
  drop: string;
  modules: string;
  status: string;
  statusOk: string;
  statusWarning: string;
  statusError: string;
  reserve: string;
  fill: string;
  title: string;
}

function breakerLabel(row: PanelSchedule['rows'][number]): string {
  return `${row.breaker.ratingA} A ${row.breaker.curve} · ${row.breaker.poles}P`;
}

function rcdLabel(row: PanelSchedule['rows'][number]): string {
  return row.rcd
    ? `${row.rcd.ratingA} A / ${row.rcd.sensitivityMa} mA`
    : '—';
}

function statusLabel(
  status: PanelSchedule['rows'][number]['status'],
  labels: PanelScheduleExportLabels,
): string {
  if (status === 'error') return labels.statusError;
  if (status === 'warning') return labels.statusWarning;
  return labels.statusOk;
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n;]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

export function buildPanelScheduleCsv(
  schedule: PanelSchedule,
  labels: PanelScheduleExportLabels,
): string {
  const header = [
    labels.way,
    labels.circuit,
    labels.name,
    labels.phase,
    labels.protection,
    labels.rcd,
    labels.cable,
    labels.load,
    labels.drop,
    labels.modules,
    labels.status,
  ];
  const rows = schedule.rows.map((row) => [
    row.way,
    row.circuitId,
    row.name,
    row.phase,
    breakerLabel(row),
    rcdLabel(row),
    `${row.cable.sectionMm2} mm² ${row.cable.material}`,
    row.currentA,
    row.voltageDropPercent,
    row.moduleWidth,
    statusLabel(row.status, labels),
  ]);

  return `\uFEFF${[header, ...rows]
    .map((cells) => cells.map(csvCell).join(';'))
    .join('\r\n')}`;
}

export function downloadPanelScheduleCsv(
  fileName: string,
  schedule: PanelSchedule,
  labels: PanelScheduleExportLabels,
): void {
  const blob = new Blob([buildPanelScheduleCsv(schedule, labels)], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = fileName.replace(/[^\w.-]+/g, '-');
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function printPanelSchedule(
  schedule: PanelSchedule,
  labels: PanelScheduleExportLabels,
): boolean {
  const target = window.open('', '_blank', 'width=980,height=1200');
  if (!target) return false;

  const boardMeta = [
    schedule.board.location,
    labels.fill
      .replace('{used}', String(schedule.usedWays))
      .replace('{total}', String(schedule.totalWays)),
    `${labels.reserve}: ${schedule.reserveWays}`,
  ]
    .filter(Boolean)
    .join(' · ');

  const rows = schedule.rows
    .map(
      (row) => `<tr>
        <td>${row.way}</td>
        <td>${escapeHtml(row.circuitId)}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${row.phase}</td>
        <td>${breakerLabel(row)}</td>
        <td>${rcdLabel(row)}</td>
        <td>${row.cable.sectionMm2} mm² ${row.cable.material}</td>
        <td>${row.currentA}</td>
        <td>${row.voltageDropPercent}%</td>
        <td>${row.moduleWidth}</td>
        <td>${statusLabel(row.status, labels)}</td>
      </tr>`,
    )
    .join('');

  target.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(
    schedule.board.name,
  )}</title><style>
    body{font-family:Inter,Arial,sans-serif;margin:32px;color:#0f172a}
    h1{font-size:20px;margin:0 0 4px}
    p.meta{color:#475569;font-size:12px;margin:0 0 18px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th,td{border:1px solid #cbd5e1;padding:5px 6px;text-align:left}
    th{background:#e2e8f0}
    td:nth-child(n+8){text-align:right}
    @media print{body{margin:12mm}}
  </style></head><body>
    <h1>${escapeHtml(schedule.board.name)}</h1>
    <p class="meta">${escapeHtml(boardMeta)}</p>
    <table><thead><tr>
      <th>${labels.way}</th><th>${labels.circuit}</th><th>${labels.name}</th>
      <th>${labels.phase}</th><th>${labels.protection}</th><th>${labels.rcd}</th>
      <th>${labels.cable}</th><th>${labels.load}</th><th>${labels.drop}</th>
      <th>${labels.modules}</th><th>${labels.status}</th>
    </tr></thead><tbody>${rows}</tbody></table>
  </body></html>`);
  target.document.close();
  target.focus();
  target.print();
  return true;
}
