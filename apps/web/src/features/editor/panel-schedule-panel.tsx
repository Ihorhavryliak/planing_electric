import type {
  PanelBoardSettings,
  PanelSchedule,
} from '@drawmyplace/calculations';
import { BREAKER_RATINGS_A } from '@drawmyplace/calculations';
import { Download, PanelTop, Printer } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/features/i18n/i18n-context';
import {
  downloadPanelScheduleCsv,
  printPanelSchedule,
  type PanelScheduleExportLabels,
} from './panel-schedule-export';

interface PanelSchedulePanelProps {
  schedule: PanelSchedule;
  onBoardChange: (board: PanelBoardSettings) => void;
  onSelectCircuit?: (circuitId: string) => void;
  fileName?: string;
}

const ROWS = [1, 2, 3, 4, 5, 6, 8, 10, 12];
const WAYS = [6, 8, 12, 18, 24];

function numeric(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function PanelSchedulePanel({
  schedule,
  onBoardChange,
  onSelectCircuit,
  fileName = 'panel-schedule',
}: PanelSchedulePanelProps) {
  const { t, formatNumber } = useI18n();
  const [board, setBoard] = useState<PanelBoardSettings>(schedule.board);
  const boardRef = useRef(schedule.board);
  const [printBlocked, setPrintBlocked] = useState(false);

  function update(patch: Partial<PanelBoardSettings>) {
    const next = { ...boardRef.current, ...patch };
    boardRef.current = next;
    setBoard(next);
    onBoardChange(next);
  }

  const labels: PanelScheduleExportLabels = {
    way: t('panel.way'),
    circuit: t('panel.circuit'),
    name: t('panel.name'),
    phase: t('panel.phase'),
    protection: t('panel.protection'),
    rcd: t('panel.rcd'),
    cable: t('panel.cable'),
    load: t('panel.load'),
    drop: t('panel.drop'),
    modules: t('panel.module'),
    status: t('panel.status'),
    statusOk: t('panel.statusOk'),
    statusWarning: t('panel.statusWarning'),
    statusError: t('panel.statusError'),
    reserve: t('panel.reserve'),
    fill: t('panel.fill'),
    title: t('panel.title'),
  };

  const statusClass = (status: PanelSchedule['rows'][number]['status']) =>
    status === 'error'
      ? 'text-rose-300'
      : status === 'warning'
        ? 'text-amber-300'
        : 'text-emerald-300';

  return (
    <section
      data-testid="panel-schedule"
      className="editor-panel p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-white">
          <PanelTop className="h-4 w-4 text-amber-300" />
          {t('panel.title')}
        </h2>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] tabular-nums ${
            schedule.issues.some((issue) => issue.severity === 'error')
              ? 'border-rose-400/25 bg-rose-400/10 text-rose-200'
              : schedule.issues.length > 0
                ? 'border-amber-400/25 bg-amber-400/10 text-amber-200'
                : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
          }`}
        >
          {t('panel.fill', {
            used: schedule.usedWays,
            total: schedule.totalWays,
          })}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        {t('panel.hint')}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-[11px] text-slate-400">
          {t('panel.name')}
          <Input
            value={board.name}
            maxLength={80}
            onChange={(event) => update({ name: event.target.value })}
            className="mt-1 h-8 text-xs"
          />
        </label>
        <label className="text-[11px] text-slate-400">
          {t('panel.location')}
          <Input
            value={board.location ?? ''}
            maxLength={120}
            onChange={(event) =>
              update({ location: event.target.value || null })
            }
            className="mt-1 h-8 text-xs"
          />
        </label>
        <label className="text-[11px] text-slate-400">
          {t('panel.rows')}
          <select
            value={board.rows}
            onChange={(event) =>
              update({ rows: numeric(event.target.value, board.rows) })
            }
            className="mt-1 h-8 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-xs text-slate-100"
          >
            {ROWS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-slate-400">
          {t('panel.waysPerRow')}
          <select
            value={board.waysPerRow}
            onChange={(event) =>
              update({
                waysPerRow: numeric(event.target.value, board.waysPerRow),
              })
            }
            className="mt-1 h-8 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-xs text-slate-100"
          >
            {WAYS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 text-[11px] text-slate-400">
          {t('panel.mainBreaker')}
          <select
            value={board.mainBreaker.ratingA}
            onChange={(event) =>
              update({
                mainBreaker: {
                  ...board.mainBreaker,
                  ratingA: numeric(
                    event.target.value,
                    board.mainBreaker.ratingA,
                  ),
                },
              })
            }
            className="mt-1 h-8 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-xs text-slate-100"
          >
            {BREAKER_RATINGS_A.map((value) => (
              <option key={value} value={value}>
                {value} A
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className={`h-full rounded-full ${
              schedule.fillPercent > 100
                ? 'bg-rose-400'
                : schedule.fillPercent >= 80
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
            }`}
            style={{ width: `${Math.min(100, schedule.fillPercent)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-500">
          <span>{formatNumber(schedule.fillPercent, { maximumFractionDigits: 1 })}%</span>
          <span>
            {t('panel.reserve')}: {schedule.reserveWays}
          </span>
        </div>
      </div>

      {schedule.rows.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">{t('panel.noCircuits')}</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {schedule.rows.map((row) => (
            <li key={row.circuitId}>
              <button
                type="button"
                onClick={() => onSelectCircuit?.(row.circuitId)}
                className="w-full rounded-xl border border-white/5 bg-white/[0.02] px-2.5 py-2 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
              >
                <span className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="min-w-0 truncate text-slate-200">
                    <span className="mr-1.5 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-amber-200">
                      {row.way}
                    </span>
                    <span className="font-mono text-amber-200">
                      {row.circuitId}
                    </span>{' '}
                    {row.name}
                  </span>
                  <span className={`shrink-0 text-[10px] ${statusClass(row.status)}`}>
                    {row.phase}
                  </span>
                </span>
                <span className="mt-1 grid grid-cols-3 gap-1 text-[10px] text-slate-400">
                  <span>
                    <span className="block text-slate-500">
                      {t('panel.protection')}
                    </span>
                    {row.breaker.ratingA} A {row.breaker.curve} ·{' '}
                    {row.moduleWidth} {t('panel.module')}
                  </span>
                  <span>
                    <span className="block text-slate-500">
                      {t('panel.rcd')}
                    </span>
                    {row.rcd
                      ? `${row.rcd.ratingA} A / ${row.rcd.sensitivityMa} mA`
                      : '—'}
                  </span>
                  <span>
                    <span className="block text-slate-500">
                      {t('panel.cable')}
                    </span>
                    {row.cable.sectionMm2} mm²
                  </span>
                </span>
                <span className="mt-1 flex justify-between text-[10px] text-slate-500">
                  <span>
                    {t('panel.load')}: {formatNumber(row.currentA, { maximumFractionDigits: 1 })}
                  </span>
                  <span>
                    {t('panel.drop')}: {formatNumber(row.voltageDropPercent, {
                      maximumFractionDigits: 1,
                    })}%
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {schedule.issues.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {schedule.issues.map((issue, index) => (
            <li
              key={`${issue.code}-${index}`}
              className={`rounded-lg border px-2.5 py-1.5 text-[11px] leading-relaxed ${
                issue.severity === 'error'
                  ? 'border-rose-400/20 bg-rose-400/10 text-rose-100'
                  : 'border-amber-400/20 bg-amber-400/10 text-amber-100'
              }`}
            >
              {t(`panel.issue.${issue.code}`, issue.params)}
            </li>
          ))}
        </ul>
      ) : null}

      {printBlocked ? (
        <p className="mt-2 text-[11px] text-amber-200">
          {t('panel.printBlocked')}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          data-testid="panel-export-csv"
          onClick={() =>
            downloadPanelScheduleCsv(`${fileName}-panel.csv`, schedule, labels)
          }
        >
          <Download className="h-4 w-4" />
          {t('panel.exportCsv')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => setPrintBlocked(!printPanelSchedule(schedule, labels))}
        >
          <Printer className="h-4 w-4" />
          {t('panel.print')}
        </Button>
      </div>
    </section>
  );
}
