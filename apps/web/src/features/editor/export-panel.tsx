import type {
  Circuit,
  PlanCalculation,
  PlanDrawing,
  PublicPoint,
  PublicRoute,
  PublicMaterial,
  SignalingLoop,
} from '@drawmyplace/contracts';
import type {
  ElectricalPlanResult,
  SignalingTakeoff,
} from '@drawmyplace/calculations';
import {
  Box,
  Download,
  FileCode2,
  FileJson2,
  FileSpreadsheet,
  LoaderCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-context';
import { getErrorMessage } from '@/lib/api';
import {
  downloadBytes,
  downloadSvg,
  downloadTextFile,
  loadProjectExport,
  projectExportFileName,
} from './export-files';
import { buildPlanSvg } from './svg-export';
import { buildSchematicSvg } from './schematic-export';
import { buildCircuitNumbering } from './circuit-numbering';
import { buildCableJournal, buildCableJournalCsv } from './cable-journal';
import {
  buildReportCsv,
  buildReportTable,
  buildReportsWorkbook,
  getReportDefinition,
  REPORT_DEFINITIONS,
} from './reports';
import { XLSX_MIME } from './xlsx';
import { buildIfc } from './ifc-export';
import { buildSignalingSchematicSvg } from './signaling-schematic';

interface ExportPanelProps {
  drawing: PlanDrawing | null;
  calculation?: PlanCalculation | null;
  circuits?: readonly Circuit[];
  points?: readonly PublicPoint[];
  routes?: readonly PublicRoute[];
  electrical?: ElectricalPlanResult | null;
  signalingLoops?: readonly SignalingLoop[];
  signaling?: SignalingTakeoff | null;
  materials?: readonly PublicMaterial[];
  projectId?: string;
  title?: string;
  subtitle?: string;
}

function cableLengthsByCircuit(
  calculation: PlanCalculation | null | undefined,
): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const route of calculation?.routes ?? []) {
    const key = route.circuitId ?? '';
    totals[key] = (totals[key] ?? 0) + (route.requiredLength ?? 0);
  }

  return totals;
}

export function ExportPanel({
  drawing,
  calculation = null,
  circuits = [],
  points = [],
  routes = [],
  electrical = null,
  signalingLoops = [],
  signaling = null,
  materials = [],
  projectId,
  title,
  subtitle,
}: ExportPanelProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const planName = title ?? 'plan';

  function exportPlanSvg() {
    if (!drawing) return;
    downloadSvg(
      `${planName}.svg`,
      buildPlanSvg(drawing, circuits, { title, subtitle }),
    );
  }

  function exportSchematicSvg() {
    if (!drawing) return;
    downloadSvg(
      `${planName}-schematic.svg`,
      buildSchematicSvg(drawing, cableLengthsByCircuit(calculation), {
        title: t('export.schematicTitle'),
        subtitle: subtitle ?? title ?? '',
        circuits,
        electrical,
      }),
    );
  }

  function exportCableJournal() {
    if (!drawing) return;
    const numbering = buildCircuitNumbering(circuits, electrical);
    const rows = buildCableJournal({
      circuits,
      points: points.length > 0 ? points : drawing.points,
      routes: routes.length > 0 ? routes : drawing.routes,
      cableLengths: cableLengthsByCircuit(calculation),
      electrical,
      numbering,
    });
    downloadTextFile(
      `${planName}-cable-journal.csv`,
      buildCableJournalCsv(rows, [
        t('journal.address'),
        t('journal.wire'),
        t('journal.terminal'),
        t('journal.circuit'),
        t('journal.name'),
        t('journal.phase'),
        t('journal.breaker'),
        t('journal.rcd'),
        t('journal.cable'),
        t('journal.length'),
      ]),
      'text/csv',
    );
  }

  function exportReportsExcel() {
    if (!drawing) return;

    const source = {
      t,
      drawing,
      circuits,
      points,
      routes,
      calculation,
      electrical,
    };
    const reports = REPORT_DEFINITIONS.map((definition) => ({
      id: definition.id,
      table: buildReportTable(definition.id, source),
      name: t(definition.titleKey),
    })).filter((report) => report.table.rows.length > 0);

    if (reports.length === 0) return;

    downloadBytes(
      `${planName}-reports.xlsx`,
      buildReportsWorkbook(reports, { title: planName }),
      XLSX_MIME,
    );
  }

  function exportSignalingSchematic() {
    if (!drawing || signalingLoops.length === 0) return;
    downloadSvg(
      `${planName}-signaling-schematic.svg`,
      buildSignalingSchematicSvg({
        loops: signalingLoops,
        points: points.length > 0 ? points : drawing.points,
        takeoff: signaling,
        title: t('export.signalingSchematicTitle'),
        subtitle: subtitle ?? title ?? '',
        labels: {
          panel: t('signaling.panel'),
          devices: t('report.field.devices'),
          address: t('signaling.address'),
        },
      }),
    );
  }

  function signalingReportCsv(
    id: 'signaling-cable' | 'ppkp-schedule' | 'battery-report',
    suffix: string,
  ) {
    if (!drawing || signalingLoops.length === 0) return;
    const table = buildReportTable(id, {
      t,
      drawing,
      circuits,
      points,
      routes,
      calculation,
      electrical,
      signalingLoops,
      signaling,
      materials,
    });
    if (table.rows.length === 0) return;
    downloadTextFile(
      `${planName}-${suffix}.csv`,
      buildReportCsv(table),
      'text/csv',
    );
  }

  function exportSignalingWorkbook() {
    if (!drawing || signalingLoops.length === 0) return;
    const source = {
      t,
      drawing,
      circuits,
      points,
      routes,
      calculation,
      electrical,
      signalingLoops,
      signaling,
      materials,
    };
    const ids = [
      'signaling-equipment',
      'signaling-cable',
      'ppkp-schedule',
      'battery-report',
    ] as const;
    const reports = ids
      .map((id) => ({
        id,
        table: buildReportTable(id, source),
        name: t(getReportDefinition(id).titleKey),
      }))
      .filter((report) => report.table.rows.length > 0);
    if (reports.length === 0) return;

    downloadBytes(
      `${planName}-signaling.xlsx`,
      buildReportsWorkbook(reports, { title: planName }),
      XLSX_MIME,
    );
  }

  function exportIfc() {
    if (!drawing) return;

    const result = buildIfc({
      projectName: title ?? 'Project',
      planName: subtitle ?? null,
      drawing,
      circuits,
    });

    downloadTextFile(result.fileName, result.text, 'application/x-step');
  }

  async function exportProjectJson() {
    if (!projectId) return;

    setBusy('json');
    setError(null);
    try {
      const payload = await loadProjectExport(projectId);
      downloadTextFile(
        projectExportFileName(payload.project),
        JSON.stringify(payload, null, 2),
        'application/json',
      );
    } catch (exportError) {
      setError(getErrorMessage(exportError));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="editor-panel p-4 print:hidden">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">
          {t('export.title')}
        </h2>
        <Download className="h-4 w-4 text-amber-300" />
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        {t('export.hint')}
      </p>

      <div className="mt-3 grid gap-2">
        <Button
          variant="outline"
          size="sm"
          className="justify-start"
          disabled={!drawing}
          onClick={exportPlanSvg}
        >
          <FileCode2 className="h-4 w-4" />
          {t('export.planSvg')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="justify-start"
          disabled={!drawing}
          onClick={exportSchematicSvg}
        >
          <FileCode2 className="h-4 w-4" />
          {t('export.schematicSvg')}
        </Button>
        {circuits.length > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="justify-start"
            disabled={!drawing}
            onClick={exportCableJournal}
          >
            <Download className="h-4 w-4" />
            {t('export.cableJournal')}
          </Button>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          className="justify-start"
          disabled={!drawing}
          onClick={exportIfc}
        >
          <Box className="h-4 w-4" />
          {t('export.ifc')}
        </Button>
        {drawing && !drawing.calibration ? (
          <p className="px-1 text-[10px] leading-relaxed text-amber-300/80">
            {t('export.ifcUncalibrated')}
          </p>
        ) : null}
        {signalingLoops.length > 0 ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className="justify-start"
              disabled={!drawing}
              onClick={exportSignalingSchematic}
            >
              <FileCode2 className="h-4 w-4" />
              {t('export.signalingSchematic')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start"
              disabled={!drawing}
              onClick={exportSignalingWorkbook}
            >
              <FileSpreadsheet className="h-4 w-4" />
              {t('export.signalingWorkbook')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start"
              disabled={!drawing}
              onClick={() => signalingReportCsv('signaling-cable', 'signal-cables')}
            >
              <Download className="h-4 w-4" />
              {t('export.signalingCableJournal')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="justify-start"
              disabled={!drawing}
              onClick={() => signalingReportCsv('battery-report', 'battery')}
            >
              <Download className="h-4 w-4" />
              {t('export.batteryReport')}
            </Button>
          </>
        ) : null}
        <Button
          variant="outline"
          size="sm"
          className="justify-start"
          disabled={!drawing}
          onClick={exportReportsExcel}
        >
          <FileSpreadsheet className="h-4 w-4" />
          {t('export.reportsExcel')}
        </Button>
        {projectId ? (
          <Button
            variant="outline"
            size="sm"
            className="justify-start"
            disabled={busy === 'json'}
            onClick={() => void exportProjectJson()}
          >
            {busy === 'json' ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <FileJson2 className="h-4 w-4" />
            )}
            {t('export.projectJson')}
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-[11px] text-rose-300">
          {error}
        </p>
      ) : null}
    </section>
  );
}
