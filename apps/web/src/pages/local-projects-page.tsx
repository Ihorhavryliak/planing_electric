import {
  ArrowUpRight,
  CloudUpload,
  Download,
  HardDrive,
  Map as MapIcon,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import {
  createDimension,
  createOpening,
  createPoint,
  createRoom,
  createRoute,
  createWall,
  saveCalibration,
} from '@/features/editor/drawing-api';
import {
  createBlankPlan,
  createFloor,
  updatePlan,
} from '@/features/editor/editor-api';
import { createProject } from '@/features/projects/projects-api';
import { createDemoLocalProject } from '@/features/local/demo-project';
import { DemoHint } from '@/features/editor/editor-guide';
import { buildPlanSvg } from '@/features/editor/svg-export';
import editorPreview from '@/assets/editor-preview.png';
import {
  createLocalProject,
  deleteLocalProject,
  normalizeLocalProject,
  listLocalProjects,
  saveLocalProject,
  type LocalProject,
} from '@/features/local/local-db';
import { useI18n } from '@/features/i18n/i18n-context';
import { useToast } from '@/features/toast/toast-context';
import { CardSkeleton } from '@/components/ui/skeleton';
import { Dialog } from '@/components/ui/dialog';
import { WorkspaceHeader } from '@/features/workspace/workspace-header';
import { getErrorMessage } from '@/lib/api';

export function LocalProjectsPage() {
  const { formatDate, t } = useI18n();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const thumbnails = useMemo(() => {
    const map = new Map<string, string>();

    for (const project of projects) {
      try {
        const svg = buildPlanSvg(
          { planId: project.id, ...project.drawing },
          project.drawing.circuits,
        );
        map.set(
          project.id,
          `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        );
      } catch {
        // A malformed snapshot should still be listed and exportable.
      }
    }

    return map;
  }, [projects]);

  async function reload() {
    setProjects(await listLocalProjects());
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const project = createLocalProject(name.trim() || t('local.defaultName'));
      await saveLocalProject(project);
      setName('');
      navigate(`/local/${project.id}`);
    } catch (err) {
      toast({ tone: 'error', title: t('local.createFailed'), description: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function handleDemo() {
    setBusy(true);
    try {
      const project = createDemoLocalProject(t('local.demoName'), {
        livingRoom: t('demo.livingRoom'),
        kitchen: t('demo.kitchen'),
        bedroom: t('demo.bedroom'),
        bathroom: t('demo.bathroom'),
        lighting: t('demo.lighting'),
        power: t('demo.power'),
        livingSwitches: t('demo.livingSwitches'),
        kitchenSwitches: t('demo.kitchenSwitches'),
        lowVoltage: t('demo.lowVoltage'),
        securityLoop: t('demo.securityLoop'),
        fireLoop: t('demo.fireLoop'),
        firePanel: t('demo.firePanel'),
      });
      await saveLocalProject(project);
      toast({
        tone: 'success',
        title: t('local.demoCreated'),
        description: t('signaling.hint'),
      });
      navigate(`/local/${project.id}`);
    } catch (err) {
      toast({ tone: 'error', title: t('local.createFailed'), description: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(project: LocalProject) {
    if (!window.confirm(t('local.deleteConfirm', { name: project.name })))
      return;
    await deleteLocalProject(project.id);
    await reload();
    toast({
      tone: 'info',
      title: t('local.deleted', { name: project.name }),
      action: {
        label: t('common.undo'),
        onClick: () => {
          void saveLocalProject(project).then(reload);
        },
      },
    });
  }

  function handleExport(project: LocalProject) {
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name.replace(/[^\w-]+/g, '-') || 'local-project'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(file: File) {
    try {
      const parsed = normalizeLocalProject(
        JSON.parse(await file.text()) as unknown,
      );
      if (!parsed) {
        toast({
          tone: 'error',
          title: t('local.importFailed'),
          description: t('local.notLocalProject'),
        });
        return;
      }
      const project: LocalProject = {
        ...parsed,
        id: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
      };
      await saveLocalProject(project);
      await reload();
      setImportOpen(false);
      toast({ tone: 'success', title: t('local.imported') });
    } catch (err) {
      toast({
        tone: 'error',
        title: t('local.importFailed'),
        description: err instanceof Error ? err.message : t('local.importFailed'),
      });
    }
  }

  async function handleSync(project: LocalProject) {
    if (!user) {
      navigate('/login');
      return;
    }
    setBusy(true);
    try {
      const created = await createProject({ name: project.name });
      const floor = await createFloor(created.id, { name: 'Floor 1' });
      const plan = await createBlankPlan(floor.id);
      const drawing = project.drawing;

      if (drawing.circuits.length > 0) {
        await updatePlan(plan.id, {
          calculationSettings: { circuits: drawing.circuits },
          expectedVersion: plan.version,
        });
      }

      if (drawing.calibration) {
        await saveCalibration(plan.id, {
          pointA: drawing.calibration.pointA,
          pointB: drawing.calibration.pointB,
          realDistance: drawing.calibration.realDistance,
          unit: drawing.calibration.unit,
        });
      }

      const wallIds = new Map<string, string>();
      for (const wall of drawing.walls) {
        const saved = await createWall(plan.id, {
          geometry: wall.geometry,
          thickness: wall.thickness,
          label: wall.label,
        });
        wallIds.set(wall.id, saved.id);
      }
      for (const room of drawing.rooms) {
        await createRoom(plan.id, {
          name: room.name,
          boundary: room.boundary,
        });
      }
      for (const dimension of drawing.dimensions) {
        await createDimension(plan.id, {
          pointA: dimension.pointA,
          pointB: dimension.pointB,
          offset: dimension.offset,
          label: dimension.label,
        });
      }
      for (const point of drawing.points) {
        await createPoint(plan.id, {
          type: point.type,
          x: point.x,
          y: point.y,
          rotation: point.rotation,
          label: point.label,
          mountingHeight: point.mountingHeight,
          properties: point.properties,
        });
      }
      for (const route of drawing.routes) {
        await createRoute(plan.id, {
          geometry: route.geometry,
          circuitId: route.circuitId,
          materialId: route.materialId,
          settings: route.settings,
        });
      }
      for (const opening of drawing.openings) {
        const wallId = wallIds.get(opening.wallId);
        if (!wallId) continue;
        await createOpening(plan.id, {
          wallId,
          type: opening.type,
          offset: opening.offset,
          width: opening.width,
          height: opening.height,
          sillHeight: opening.sillHeight,
          flipped: opening.flipped,
          label: opening.label,
        });
      }

      await deleteLocalProject(project.id);
      await reload();
      toast({ tone: 'success', title: t('local.synced') });
      navigate(`/app/projects/${created.id}/editor`);
    } catch (err) {
      toast({ tone: 'error', title: t('local.syncFailed'), description: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <WorkspaceHeader badge={t('local.badge')} />
      <main id="main-content" className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-widest text-[var(--dmp-color-brand)] uppercase">
              {t('local.badge')}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {t('local.title')}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
              {t('local.subtitle')}
            </p>
          </div>
          {user ? (
            <Link
              to="/app"
              className="inline-flex h-10 items-center rounded-lg border border-white/15 bg-white/5 px-4 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
            >
              {t('local.goWorkspace')}
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--dmp-color-brand)]"
            >
              <UserRound className="h-4 w-4" />
              {t('local.signInSync')}
            </Link>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-400">
          <HardDrive className="h-4 w-4 shrink-0 text-[var(--dmp-color-brand)]" />
          <p className="min-w-0 flex-1 leading-relaxed">
            {user ? t('local.storageBanner') : t('local.storageBannerSignedOut')}
          </p>
          {!user ? (
            <Link
              to="/login"
              className="shrink-0 text-[var(--dmp-color-brand)] hover:underline"
            >
              {t('local.signInSync')}
            </Link>
          ) : null}
        </div>

        <section className="mt-6 app-panel p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-[var(--dmp-color-brand)]" />
            <h2 className="text-sm font-semibold text-white">
              {t('local.newProject')}
            </h2>
          </div>
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={handleCreate}
          >
          <Input
            ref={nameInputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('local.namePlaceholder')}
            className="min-w-56 flex-1"
          />
          <Button type="submit" disabled={busy}>
            <Plus className="h-4 w-4" />
            {t('local.create')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void handleDemo()}
          >
            <Sparkles className="h-4 w-4" />
            {t('local.demo')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="h-4 w-4" />
            {t('local.import')}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
              event.target.value = '';
            }}
          />
          </form>
        </section>

        <Dialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          title={t('local.importTitle')}
          description={t('local.importHint')}
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => setImportOpen(false)}
              >
                {t('editor.cancel')}
              </Button>
              <Button onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" />
                {t('local.chooseFile')}
              </Button>
            </>
          }
        >
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              const file = event.dataTransfer.files?.[0];
              if (file) void handleImport(file);
            }}
            onClick={() => fileRef.current?.click()}
            className={`flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${
              dragActive
                ? 'border-[var(--dmp-color-brand)] bg-[var(--dmp-color-brand)]/10'
                : 'border-white/15 bg-white/[0.02] hover:border-white/25'
            }`}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                fileRef.current?.click();
              }
            }}
          >
            <Upload className="h-6 w-6 text-[var(--dmp-color-brand)]" />
            <p className="mt-2 text-sm font-medium text-slate-200">
              {t('local.dropFile')}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {t('local.importHint')}
            </p>
          </div>
        </Dialog>

        {!loading && projects.length === 0 ? <DemoHint /> : null}

        {loading ? (
          <div
            className="mt-8 grid gap-3 sm:grid-cols-2"
            role="status"
            aria-label={t('local.loading')}
          >
            <CardSkeleton compact />
            <CardSkeleton compact />
          </div>
        ) : projects.length === 0 ? (
          <div className="mx-auto mt-8 max-w-3xl app-panel p-8 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <Plus className="h-5 w-5 text-[var(--dmp-color-brand)]" />
            </span>
            <h2 className="mt-4 text-base font-semibold text-white">
              {t('local.emptyTitle')}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
              {t('local.empty')}
            </p>
            <div className="mx-auto mt-5 max-w-md overflow-hidden rounded-xl border border-white/10 bg-slate-950/60 text-left">
              <img
                src={editorPreview}
                alt={t('local.demoCardTitle')}
                className="aspect-[16/9] w-full object-cover object-top opacity-90"
              />
              <div className="p-3">
                <p className="text-sm font-semibold text-white">
                  {t('local.demoCardTitle')}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {t('local.demoCardBody')}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <Button
                onClick={() => {
                  nameInputRef.current?.focus();
                  nameInputRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                  });
                }}
              >
                <Plus className="h-4 w-4" />
                {t('local.emptyCta')}
              </Button>
              <Button variant="outline" onClick={() => void handleDemo()}>
                <Sparkles className="h-4 w-4" />
                {t('local.emptyDemo')}
              </Button>
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" />
                {t('local.import')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => {
              const thumbnail = thumbnails.get(project.id);

              return (
                <article
                  key={project.id}
                  className="app-panel flex flex-col overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/local/${project.id}`)}
                    className="group relative block aspect-[16/10] w-full overflow-hidden bg-slate-950 text-left"
                    aria-label={t('local.openProject', { name: project.name })}
                  >
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={t('local.thumbnailAlt', { name: project.name })}
                        className="h-full w-full object-contain p-3 transition-transform duration-200 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-slate-600">
                        <MapIcon className="h-8 w-8" />
                      </span>
                    )}
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full border border-white/15 bg-slate-950/80 px-2 py-0.5 text-[10px] text-slate-300 backdrop-blur">
                      <HardDrive className="h-2.5 w-2.5" />
                      {t('local.localOnly')}
                    </span>
                  </button>
                  <div className="flex flex-1 flex-col p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold text-white">
                          {project.name}
                        </h2>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {formatDate(project.updatedAt)}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] text-slate-500">
                        {project.drawing.points.length} ·{' '}
                        {t('local.pointsShort')}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                      {project.drawing.routes.length} {t('local.routesShort')} ·{' '}
                      {project.drawing.rooms.length} {t('local.roomsShort')} ·{' '}
                      {project.drawing.circuits.length}{' '}
                      {t('local.circuitsShort')}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        onClick={() => navigate(`/local/${project.id}`)}
                      >
                        {t('local.open')}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExport(project)}
                        title={t('local.exportJson')}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleSync(project)}
                        disabled={busy}
                        title={user ? t('local.sync') : t('local.signInSync')}
                      >
                        <CloudUpload className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto text-slate-500 hover:text-rose-300"
                        onClick={() => void handleDelete(project)}
                        title={t('local.delete')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}