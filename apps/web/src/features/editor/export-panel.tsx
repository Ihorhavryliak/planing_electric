import type {
  Circuit,
  PlanCalculation,
  PlanDrawing,
  PublicPoint,
  PublicRoute,
} from '@drawmyplace/contracts';
import type { ElectricalPlanResult } from '@drawmyplace/calculations';
import { Download, FileCode2, FileJson2, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-context';
import { getErrorMessage } from '@/lib/api';
import {
  downloadSvg,
  downloadTextFile,
  loadProjectExport,
  projectExportFileName,
} from './export-files';
import { buildPlanSvg } from './svg-export';
import { buildSchematicSvg } from './schematic-export';
import { buildCircuitNumbering } from './circuit-numbering';
import { buildCableJournal, buildCableJournalCsv } from './cable-journal';

interface ExportPanelProps {
  drawing: PlanDrawing | null;
  calculation?: PlanCalculation | null;
  circuits?: readonly Circuit[];
  points?: readonly PublicPoint[];
  routes?: readonly PublicRoute[];
  electrical?: ElectricalPlanResult | null;
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
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 print:hidden">
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
