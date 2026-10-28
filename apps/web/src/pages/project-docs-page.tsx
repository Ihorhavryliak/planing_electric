import type {
  PlanCalculation,
  PlanDrawing,
  PublicEstimate,
  PublicFloor,
  PublicMaterial,
  PublicProject,
} from '@drawmyplace/contracts';
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Layers,
  LoaderCircle,
  Printer,
  ShieldCheck,
  Tags,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, buttonVariants } from '@/components/ui/button';
import { ValidationPanel } from '@/features/editor/validation-panel';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { ExportPanel } from '@/features/editor/export-panel';
import { ReportsPanel } from '@/features/editor/reports-panel';
import { buildElectricalPlan } from '@/features/editor/electrical';
import { buildSignalingModel } from '@/features/editor/signaling';
import { validatePlan } from '@/features/editor/validation';
import { buildPanelSchedule, buildTakeoff } from '@drawmyplace/calculations';
import { DEVICE_LIBRARY } from '@drawmyplace/contracts';
import { getPlanCalculation, getPlanDrawing } from '@/features/editor/drawing-api';
import { listFloors } from '@/features/editor/editor-api';
import {
  createExportLinks,
  listEstimatesByProject,
  listMaterials,
} from '@/features/editor/materials-api';
import { useI18n } from '@/features/i18n/i18n-context';
import { getProject } from '@/features/projects/projects-api';
import { VariantsPanel } from '@/features/variants/variants-panel';
import { WorkspaceHeader } from '@/features/workspace/workspace-header';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

type DocsTab =
  | 'materials'
  | 'estimate'
  | 'reports'
  | 'validation'
  | 'variants'
  | 'print';

const TABS: { id: DocsTab; icon: typeof Tags; label: string }[] = [
  { id: 'materials', icon: Tags, label: 'docs.materials' },
  { id: 'estimate', icon: FileText, label: 'docs.estimate' },
  { id: 'reports', icon: FileSpreadsheet, label: 'docs.reports' },
  { id: 'validation', icon: ShieldCheck, label: 'docs.validation' },
  { id: 'variants', icon: Layers, label: 'docs.variants' },
  { id: 'print', icon: Printer, label: 'docs.print' },
];

function estimateTotal(estimate: PublicEstimate): number {
  return estimate.items.reduce((sum, item) => sum + (item.subtotal ?? 0), 0);
}

export function ProjectDocsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { t, formatDate, formatCurrency, formatNumber, formatMeters } = useI18n();
  const [tab, setTab] = useState<DocsTab>('materials');
  const [project, setProject] = useState<PublicProject | null>(null);
  const [floors, setFloors] = useState<PublicFloor[]>([]);
  const [floorId, setFloorId] = useState<string>('');
  const [drawing, setDrawing] = useState<PlanDrawing | null>(null);
  const [calculation, setCalculation] = useState<PlanCalculation | null>(null);
  const [materials, setMaterials] = useState<PublicMaterial[]>([]);
  const [estimates, setEstimates] = useState<PublicEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    void Promise.all([
      getProject(projectId, controller.signal),
      listFloors(projectId, controller.signal),
      listMaterials(),
      listEstimatesByProject(projectId),
    ])
      .then(([loadedProject, loadedFloors, loadedMaterials, loadedEstimates]) => {
        if (controller.signal.aborted) return;

        setProject(loadedProject);
        setFloors(loadedFloors);
        setMaterials(loadedMaterials);
        setEstimates(loadedEstimates);

        const withPlan = loadedFloors.find((floor) => floor.plan);
        if (withPlan) setFloorId((current) => current || withPlan.id);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [projectId]);

  const plan = floors.find((floor) => floor.id === floorId)?.plan ?? null;

  useEffect(() => {
    if (!plan) {
      setDrawing(null);
      setCalculation(null);
      return;
    }

    const controller = new AbortController();
    setPlanLoading(true);

    void Promise.all([
      getPlanDrawing(plan.id, controller.signal),
      getPlanCalculation(plan.id, controller.signal),
    ])
      .then(([loadedDrawing, loadedCalculation]) => {
        if (controller.signal.aborted) return;
        setDrawing(loadedDrawing);
        setCalculation(loadedCalculation);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPlanLoading(false);
      });

    return () => controller.abort();
  }, [plan]);

  const signalingLoops = plan?.calculationSettings.signaling?.loops ?? [];
  const signaling = useMemo(() => {
    if (!drawing) return null;

    return buildSignalingModel({
      loops: signalingLoops,
      points: drawing.points,
      routes: drawing.routes,
      rooms: drawing.rooms,
      metersPerUnit: drawing.calibration?.metersPerUnit ?? null,
      calculation,
    });
  }, [drawing, signalingLoops, calculation]);

  const validationIssues = useMemo(() => {
    if (!drawing) return [];

    return validatePlan({
      calibration: drawing.calibration,
      circuits: plan?.calculationSettings.circuits ?? [],
      points: drawing.points,
      routes: drawing.routes,
      walls: drawing.walls,
      openings: drawing.openings,
      materialIds: materials.map((material) => material.id),
      signaling,
      signalingLoops,
      materials,
      deviceProducts: DEVICE_LIBRARY,
    });
  }, [drawing, plan, materials, signaling, signalingLoops]);

  const electrical = useMemo(() => {
    if (!drawing || !plan) return null;

    const routeLengths = new Map(
      (calculation?.routes ?? []).map((route) => [
        route.routeId,
        route.requiredLength,
      ]),
    );

    return buildElectricalPlan({
      circuits: plan.calculationSettings.circuits ?? [],
      points: drawing.points,
      routes: drawing.routes,
      routeLengths,
      settings: plan.calculationSettings.electrical ?? null,
      calibrated: Boolean(drawing.calibration),
    });
  }, [drawing, plan, calculation]);

  const panelSchedule = useMemo(
    () => (electrical ? buildPanelSchedule(electrical) : null),
    [electrical],
  );

  const takeoff = useMemo(() => {
    if (!drawing) return null;

    const requiredByRoute = new Map(
      (calculation?.routes ?? []).map((route) => [
        route.routeId,
        route.requiredLength,
      ]),
    );
    const defaultCable =
      materials.find((material) => material.category === 'cable') ?? null;

    return buildTakeoff({
      metersPerUnit: drawing.calibration?.metersPerUnit ?? null,
      walls: drawing.walls,
      openings: drawing.openings,
      rooms: drawing.rooms,
      points: drawing.points,
      routes: drawing.routes.map((route) => ({
        circuitId: route.circuitId,
        materialId: route.materialId,
        requiredLength: requiredByRoute.get(route.id) ?? null,
      })),
      materials: materials.map((material) => ({
        id: material.id,
        unitPrice: material.unitPrice,
        unit: material.unit,
      })),
      defaultCableMaterialId: defaultCable?.id ?? null,
    });
  }, [drawing, calculation, materials]);

  const materialUsage = useMemo(() => {
    const usage = new Map<string, number>();
    for (const route of drawing?.routes ?? []) {
      if (route.materialId) {
        usage.set(route.materialId, (usage.get(route.materialId) ?? 0) + 1);
      }
    }
    return usage;
  }, [drawing]);

  const latestEstimate = estimates[0] ?? null;

  async function exportEstimate(estimate: PublicEstimate) {
    setExporting(estimate.id);
    try {
      const links = await createExportLinks(estimate.id);
      window.open(links.pdfUrl, '_blank', 'noopener,noreferrer');
    } catch (exportError) {
      setError(getErrorMessage(exportError));
    } finally {
      setExporting(null);
    }
  }

  if (loading && !project) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin text-amber-300" />
        {t('docs.loading')}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="print:hidden">
        <WorkspaceHeader />
      </div>

      <main className="page-shell print:max-w-none print:px-0 print:py-0">
        <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
          <div>
            <Link
              to={`/app/projects/${projectId}`}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t('docs.backToProject')}
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-white">
              {t('docs.title')}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              {project?.name} · {t('docs.hint')}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to={`/app/projects/${projectId}/editor`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              {t('docs.openEditor')}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              to={`/app/projects/${projectId}/estimates`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              {t('docs.openEstimates')}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="mt-4 max-w-md">
          <ExportPanel
            drawing={drawing}
            calculation={calculation}
            circuits={plan?.calculationSettings.circuits ?? []}
            projectId={projectId}
            title={project?.name}
            subtitle={floors.find((floor) => floor.id === floorId)?.name}
          />
        </div>

        {!planLoading && !plan ? (
          <div className="mt-4 app-panel flex flex-wrap items-center justify-between gap-4 p-5 print:hidden">
            <div>
              <h2 className="text-sm font-semibold text-white">
                {t('docs.emptyPlanTitle')}
              </h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-400">
                {t('docs.emptyPlanHint')}
              </p>
            </div>
            <Link
              to={`/app/projects/${projectId}/editor`}
              className={cn(buttonVariants({ size: 'sm' }))}
            >
              {t('docs.emptyPlanCta')}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100 print:hidden"
          >
            {error}
          </p>
        ) : null}

        <div className="sticky top-[4.25rem] z-20 -mx-2 mt-6 flex flex-wrap items-center gap-2 rounded-xl bg-slate-950/80 px-2 py-2 backdrop-blur print:hidden">
          <Tabs
            ariaLabel={t('docs.title')}
            value={tab}
            onChange={setTab}
            items={TABS.map(({ id, icon: Icon, label }) => ({
              id,
              label: t(label),
              icon: <Icon className="h-3.5 w-3.5" />,
            }))}
          />

          {floors.length > 1 ? (
            <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
              {t('docs.floor')}
              <select
                value={floorId}
                onChange={(event) => setFloorId(event.target.value)}
                className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-slate-200"
              >
                {floors.map((floor) => (
                  <option key={floor.id} value={floor.id} disabled={!floor.plan}>
                    {floor.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <section className="mt-4">
          {tab === 'materials' ? (
            <div className="app-panel p-5 print:border-0 print:bg-transparent print:p-0">
              <div className="flex items-center justify-between gap-3 print:hidden">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {t('docs.materials')}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {t('docs.materialsHint')}
                  </p>
                </div>
                <Link
                  to="/app/materials"
                  className="text-xs text-amber-300 hover:text-amber-200"
                >
                  {t('docs.manageMaterials')}
                </Link>
              </div>
              <table className="mt-4 w-full text-left text-xs">
                <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="pb-2">{t('docs.code')}</th>
                    <th className="pb-2">{t('docs.name')}</th>
                    <th className="pb-2">{t('docs.category')}</th>
                    <th className="pb-2">{t('docs.unit')}</th>
                    <th className="pb-2 text-right">{t('docs.price')}</th>
                    <th className="pb-2 text-right">{t('docs.usedByRoutes')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {materials.map((material) => (
                    <tr key={material.id}>
                      <td className="py-2 font-mono text-[11px] text-slate-400">
                        {material.code}
                      </td>
                      <td className="py-2 text-slate-200">{material.name}</td>
                      <td className="py-2 text-slate-400">
                        {material.category
                          ? t(`materials.category.${material.category}`)
                          : '—'}
                      </td>
                      <td className="py-2 text-slate-400">
                        {t(`units.${material.unit}`)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-slate-200">
                        {material.unitPrice === null
                          ? '—'
                          : formatCurrency(material.unitPrice)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-slate-400">
                        {materialUsage.get(material.id) ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {materials.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  {t('docs.noMaterials')}
                </p>
              ) : null}
            </div>
          ) : null}

          {tab === 'estimate' ? (
            <div className="space-y-3">
              <div className="app-panel p-5 print:hidden">
                <h2 className="text-sm font-semibold text-white">
                  {t('docs.estimate')}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {t('docs.estimateHint')}
                </p>
              </div>
              {estimates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center text-sm text-slate-400 print:hidden">
                  <FileText className="mx-auto h-6 w-6 text-slate-500" />
                  <p className="mt-2">{t('docs.noEstimates')}</p>
                  <Link
                    to={`/app/projects/${projectId}/editor`}
                    className={cn(buttonVariants({ size: 'sm' }), 'mt-4')}
                  >
                    {t('docs.generateInEditor')}
                  </Link>
                </div>
              ) : (
                estimates.map((estimate) => (
                  <article
                    key={estimate.id}
                    className="app-panel p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {t('docs.estimateVersion', { version: estimate.version })}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatDate(estimate.createdAt)} ·{' '}
                          {t(`estimates.status.${estimate.status}`)} ·{' '}
                          {t(`estimates.type.${estimate.type}`)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold tabular-nums text-amber-200">
                          {formatCurrency(estimateTotal(estimate))}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={exporting === estimate.id}
                          onClick={() => void exportEstimate(estimate)}
                        >
                          {exporting === estimate.id ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                          PDF
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 overflow-x-auto border-t border-border pt-2">
                      <table className="w-full border-collapse text-xs text-muted-foreground">
                        <thead>
                          <tr className="text-left text-[10px] uppercase tracking-wide">
                            <th className="pb-1 pr-2 font-medium">
                              {t('estimates.description')}
                            </th>
                            <th className="pb-1 pr-2 text-right font-medium">
                              {t('estimates.qty')}
                            </th>
                            <th className="pb-1 text-right font-medium">
                              {t('estimates.unit')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {estimate.items.map((item) => (
                            <tr key={item.id} className="border-b border-border/50">
                              <td className="py-1 pr-2 text-foreground">
                                {item.description}
                              </td>
                              <td className="py-1 pr-2 text-right tabular-nums text-foreground">
                                {formatNumber(item.quantity, {
                                  maximumFractionDigits: 2,
                                })}
                              </td>
                              <td className="py-1 text-right">
                                {t(`units.${item.unit}`)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                ))
              )}
            </div>
          ) : null}

          {tab === 'reports' ? (
            <ReportsPanel
              projectName={project?.name ?? ''}
              planName={floors.find((floor) => floor.id === floorId)?.name}
              drawing={drawing}
              circuits={plan?.calculationSettings.circuits ?? []}
              calculation={calculation}
              electrical={electrical}
              panelSchedule={panelSchedule}
              materials={materials}
              signalingLoops={signalingLoops}
              signaling={signaling}
            />
          ) : null}

          {tab === 'validation' ? (
            <div className="print:hidden">
              <ValidationPanel issues={validationIssues} />
            </div>
          ) : null}

          {tab === 'variants' ? (
            <div className="print:hidden">
              <VariantsPanel projectId={projectId} />
            </div>
          ) : null}

          {tab === 'print' ? (
            <div className="app-panel p-5 print:border-0 print:bg-transparent print:p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {t('docs.print')}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {t('docs.printHint')}
                  </p>
                </div>
                <div className="flex gap-2">
                  {latestEstimate ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={exporting === latestEstimate.id}
                      onClick={() => void exportEstimate(latestEstimate)}
                    >
                      <FileText className="h-4 w-4" />
                      {t('docs.estimatePdf')}
                    </Button>
                  ) : null}
                  <Button size="sm" onClick={() => window.print()}>
                    <Printer className="h-4 w-4" />
                    {t('docs.printButton')}
                  </Button>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">
                  {t('docs.document')}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-white">
                  {project?.name}
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {floors.find((floor) => floor.id === floorId)?.name} ·{' '}
                  {formatDate(new Date())}
                </p>

                {planLoading ? (
                  <div
                    role="status"
                    aria-label={t('docs.loadingPlan')}
                    className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                  >
                    <CardSkeleton compact />
                    <CardSkeleton compact />
                    <CardSkeleton compact />
                    <CardSkeleton compact />
                  </div>
                ) : !plan ? (
                  <p className="mt-6 text-sm text-slate-400">
                    {t('docs.noPlan')}
                  </p>
                ) : takeoff ? (
                  <>
                    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        {
                          label: t('takeoff.wallLength'),
                          value:
                            takeoff.wallLengthMeters === null
                              ? '—'
                              : formatMeters(takeoff.wallLengthMeters),
                        },
                        {
                          label: t('takeoff.netArea'),
                          value:
                            takeoff.netWallAreaM2 === null
                              ? '—'
                              : `${formatNumber(takeoff.netWallAreaM2, {
                                  maximumFractionDigits: 2,
                                })} m²`,
                        },
                        {
                          label: t('takeoff.roomArea'),
                          value:
                            takeoff.roomAreaM2 === null
                              ? '—'
                              : `${formatNumber(takeoff.roomAreaM2, {
                                  maximumFractionDigits: 2,
                                })} m²`,
                        },
                        {
                          label: t('takeoff.totalDevices'),
                          value: String(takeoff.totalDevices),
                        },
                        {
                          label: t('takeoff.cableTotal'),
                          value:
                            takeoff.totalCableMeters === null
                              ? '—'
                              : formatMeters(takeoff.totalCableMeters),
                        },
                        {
                          label: t('takeoff.cableCost'),
                          value:
                            takeoff.cableCost === null
                              ? '—'
                              : formatCurrency(takeoff.cableCost),
                        },
                        {
                          label: t('docs.validationIssues'),
                          value: String(validationIssues.length),
                        },
                        {
                          label: t('docs.estimatesCount'),
                          value: String(estimates.length),
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="editor-subpanel p-3 print:border-slate-300"
                        >
                          <p className="text-[11px] text-slate-500">
                            {item.label}
                          </p>
                          <p className="mt-1 text-base font-semibold text-white print:text-black">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    {validationIssues.length === 0 ? (
                      <p className="mt-4 flex items-center gap-2 text-xs text-emerald-200 print:text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {t('validation.empty')}
                      </p>
                    ) : (
                      <div className="mt-5">
                        <ValidationPanel issues={validationIssues} />
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
