import type {
  Circuit,
  PlanCalculation,
  PlanDrawing,
  PublicMaterial,
  SignalingLoop,
} from '@drawmyplace/contracts';
import type {
  ElectricalPlanResult,
  PanelSchedule,
  SignalingTakeoff,
} from '@drawmyplace/calculations';
import {
  BatteryCharging,
  Cable,
  Check,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  Package,
  Printer,
  RadioTower,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-context';
import { downloadBytes, downloadTextFile } from './export-files';
import {
  buildReportCsv,
  buildReportTable,
  buildReportsWorkbook,
  defaultReportFields,
  getReportDefinition,
  normalizeReportFields,
  REPORT_DEFINITIONS,
  reportFileName,
  reportToSheet,
  type ReportId,
  type ReportTable,
} from './reports';
import { buildXlsx, XLSX_MIME } from './xlsx';

interface ReportsPanelProps {
  projectName: string;
  planName?: string | null;
  drawing: PlanDrawing | null;
  circuits: readonly Circuit[];
  calculation?: PlanCalculation | null;
  electrical?: ElectricalPlanResult | null;
  panelSchedule?: PanelSchedule | null;
  materials?: readonly PublicMaterial[];
  signalingLoops?: readonly SignalingLoop[];
  signaling?: SignalingTakeoff | null;
  points?: PlanDrawing['points'];
  routes?: PlanDrawing['routes'];
}

const STORAGE_KEY = 'dmp:report-fields';
const REPORT_ICONS: Record<ReportId, typeof Package> = {
  equipment: Package,
  'cable-journal': Cable,
  'panel-schedule': LayoutGrid,
  'signaling-equipment': RadioTower,
  'signaling-cable': Cable,
  'ppkp-schedule': LayoutGrid,
  'battery-report': BatteryCharging,
};

type FieldSelection = Record<ReportId, string[]>;

function initialSelection(): FieldSelection {
  return {
    equipment: defaultReportFields('equipment'),
    'cable-journal': defaultReportFields('cable-journal'),
    'panel-schedule': defaultReportFields('panel-schedule'),
    'signaling-equipment': defaultReportFields('signaling-equipment'),
    'signaling-cable': defaultReportFields('signaling-cable'),
    'ppkp-schedule': defaultReportFields('ppkp-schedule'),
    'battery-report': defaultReportFields('battery-report'),
  };
}

function readSelection(): FieldSelection {
  const fallback = initialSelection();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as Partial<Record<ReportId, unknown>>;
    const next = { ...fallback };

    for (const definition of REPORT_DEFINITIONS) {
      const value = parsed[definition.id];
      if (Array.isArray(value)) {
        next[definition.id] = normalizeReportFields(
          definition.id,
          value.filter((item): item is string => typeof item === 'string'),
        );
      }
    }

    return next;
  } catch {
    return fallback;
  }
}

function writeSelection(selection: FieldSelection): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // Private mode or a full quota should not break exports.
  }
}

export function ReportsPanel({
  projectName,
  planName,
  drawing,
  circuits,
  calculation = null,
  electrical = null,
  panelSchedule = null,
  materials = [],
  signalingLoops = [],
  signaling = null,
  points,
  routes,
}: ReportsPanelProps) {
  const { t, formatDate, formatNumber } = useI18n();
  const [active, setActive] = useState<ReportId>('equipment');
  const [selection, setSelection] = useState<FieldSelection>(readSelection);

  useEffect(() => {
    writeSelection(selection);
  }, [selection]);

  const source = useMemo(
    () => ({
      t,
      drawing,
      circuits,
      calculation,
      electrical,
      panelSchedule,
      materials,
      signalingLoops,
      signaling,
      points,
      routes,
    }),
    [
      t,
      drawing,
      circuits,
      calculation,
      electrical,
      panelSchedule,
      materials,
      signalingLoops,
      signaling,
      points,
      routes,
    ],
  );

  const table = useMemo(
    () => buildReportTable(active, source, selection[active]),
    [active, source, selection],
  );
  const definition = getReportDefinition(active);
  const Icon = REPORT_ICONS[active];
  const title = t(definition.titleKey);
  const selected = new Set(selection[active]);

  function toggleField(key: string) {
    setSelection((current) => {
      const existing = current[active];
      const next = existing.includes(key)
        ? existing.filter((item) => item !== key)
        : [...existing, key];

      return {
        ...current,
        [active]: normalizeReportFields(active, next.length > 0 ? next : existing),
      };
    });
  }

  function resetFields() {
    setSelection((current) => ({
      ...current,
      [active]: defaultReportFields(active),
    }));
  }

  function exportExcel() {
    if (table.rows.length === 0) return;

    downloadBytes(
      reportFileName(projectName, active, 'xlsx'),
      buildXlsx([reportToSheet(table, title)], { title }),
      XLSX_MIME,
    );
  }

  function exportCsv() {
    if (table.rows.length === 0) return;

    downloadTextFile(
      reportFileName(projectName, active, 'csv'),
      buildReportCsv(table),
      'text/csv',
    );
  }

  function exportAll() {
    const reports = REPORT_DEFINITIONS.map((item) => ({
      id: item.id,
      table: buildReportTable(item.id, source, selection[item.id]),
      name: t(item.titleKey),
    })).filter((report) => report.table.rows.length > 0);

    if (reports.length === 0) return;

    downloadBytes(
      reportFileName(projectName, 'reports', 'xlsx'),
      buildReportsWorkbook(reports, { title: projectName }),
      XLSX_MIME,
    );
  }

  function cellText(column: ReportTable['columns'][number], value: string | number) {
    if (typeof value === 'number' && column.numeric) {
      return formatNumber(value, {
        maximumFractionDigits: column.key === 'drop' ? 2 : 1,
      });
    }

    return String(value);
  }

  return (
    <section className="app-panel p-4 print:border-0 print:bg-transparent print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-sm font-semibold text-white">{t('report.title')}</h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
            {t('report.hint')}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportAll}>
          <FileSpreadsheet className="h-4 w-4" />
          {t('report.exportAll')}
        </Button>
      </div>

      <div
        role="tablist"
        aria-label={t('report.template')}
        className="mt-3 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/[0.02] p-1 print:hidden"
      >
        {REPORT_DEFINITIONS.map((item) => {
          const TabIcon = REPORT_ICONS[item.id];

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active === item.id}
              onClick={() => setActive(item.id)}
              className={
                active === item.id
                  ? 'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-400/15 px-2 py-1.5 text-[11px] font-medium text-amber-100'
                  : 'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] text-slate-400 transition hover:bg-white/5 hover:text-slate-200'
              }
            >
              <TabIcon className="h-3.5 w-3.5" />
              {t(item.titleKey)}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
        <span className="text-[11px] uppercase tracking-wide text-slate-500">
          {t('report.fields')}
        </span>
        {definition.fields.map((field) => {
          const isOn = selected.has(field.key);

          return (
            <button
              key={field.key}
              type="button"
              aria-pressed={isOn}
              onClick={() => toggleField(field.key)}
              className={
                isOn
                  ? 'inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-100'
                  : 'inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-400 transition hover:bg-white/5 hover:text-slate-200'
              }
            >
              {isOn ? <Check className="h-3 w-3" /> : null}
              {t(field.labelKey)}
            </button>
          );
        })}
        <button
          type="button"
          onClick={resetFields}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
        >
          <RotateCcw className="h-3 w-3" />
          {t('report.reset')}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 print:hidden">
        <Button size="sm" disabled={table.rows.length === 0} onClick={exportExcel}>
          <FileSpreadsheet className="h-4 w-4" />
          {t('report.exportExcel')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={table.rows.length === 0}
          onClick={exportCsv}
        >
          <FileText className="h-4 w-4" />
          {t('report.exportCsv')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={table.rows.length === 0}
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" />
          {t('report.print')}
        </Button>
        <span className="ml-auto text-[11px] text-slate-500">
          {t('report.rows', { count: table.rows.length })}
        </span>
      </div>

      <div className="mt-6 hidden print:block">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">
          {t('report.generated', { date: formatDate(new Date()) })}
        </p>
        <h2 className="report-print-title mt-1 text-xl font-semibold text-white">
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-slate-400">
          {projectName}
          {planName ? ` · ${planName}` : ''}
        </p>
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-slate-500 print:hidden">
        <Icon className="h-4 w-4 text-amber-300" />
        {t(definition.hintKey)}
      </p>

      {table.rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-6 text-center text-xs text-slate-400 print:hidden">
          {t('report.empty')}
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="report-table w-full border-collapse text-left text-xs">
            <thead>
              <tr>
                {table.columns.map((column) => (
                  <th
                    key={column.key}
                    className={
                      column.numeric
                        ? 'border-b border-white/10 pb-2 pr-3 text-right text-[11px] font-medium uppercase tracking-wide text-slate-500'
                        : 'border-b border-white/10 pb-2 pr-3 text-[11px] font-medium uppercase tracking-wide text-slate-500'
                    }
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="align-top">
                  {row.map((value, columnIndex) => {
                    const column = table.columns[columnIndex];

                    return (
                      <td
                        key={column?.key ?? columnIndex}
                        className={
                          column?.numeric
                            ? 'border-b border-white/5 py-1.5 pr-3 text-right tabular-nums text-slate-200'
                            : 'border-b border-white/5 py-1.5 pr-3 text-slate-300'
                        }
                      >
                        {cellText(column ?? { key: '', label: '', numeric: false }, value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            {table.total ? (
              <tfoot>
                <tr className="font-semibold text-white">
                  {table.total.map((value, index) => {
                    const column = table.columns[index];

                    return (
                      <td
                        key={column?.key ?? index}
                        className={
                          column?.numeric
                            ? 'pt-2 pr-3 text-right tabular-nums'
                            : 'pt-2 pr-3'
                        }
                      >
                        {cellText(column ?? { key: '', label: '', numeric: false }, value)}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
    </section>
  );
}
