import {
  ArrowUpRight,
  Download,
  LoaderCircle,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
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
import {
  createLocalProject,
  deleteLocalProject,
  normalizeLocalProject,
  listLocalProjects,
  saveLocalProject,
  type LocalProject,
} from '@/features/local/local-db';
import { useI18n } from '@/features/i18n/i18n-context';
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
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    setError(null);
    try {
      const project = createLocalProject(name.trim() || t('local.defaultName'));
      await saveLocalProject(project);
      setName('');
      navigate(`/local/${project.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDemo() {
    setBusy(true);
    setError(null);
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
      });
      await saveLocalProject(project);
      navigate(`/local/${project.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(project: LocalProject) {
    if (!window.confirm(t('local.deleteConfirm', { name: project.name })))
      return;
    await deleteLocalProject(project.id);
    await reload();
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
    setError(null);
    try {
      const parsed = normalizeLocalProject(
        JSON.parse(await file.text()) as unknown,
      );
      if (!parsed) {
        setError(t('local.notLocalProject'));
        return;
      }
      const project: LocalProject = {
        ...parsed,
        id: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
      };
      await saveLocalProject(project);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('local.importFailed'));
    }
  }

  async function handleSync(project: LocalProject) {
    if (!user) {
      navigate('/login');
      return;
    }
    setBusy(true);
    setError(null);
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
      navigate(`/app/projects/${created.id}/editor`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <WorkspaceHeader badge={t('local.badge')} />
      <main id="main-content" className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              {t('local.title')}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {t('local.subtitle')}
            </p>
          </div>
          {user ? (
            <Link to="/app" className="text-sm text-amber-300">
              {t('local.goWorkspace')}
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm text-amber-300"
            >
              <UserRound className="h-4 w-4" />
              {t('local.signInSync')}
            </Link>
          )}
        </div>

        <form className="mt-6 flex flex-wrap gap-2" onSubmit={handleCreate}>
          <Input
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
            onClick={() => fileRef.current?.click()}
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

        {error ? (
          <p role="alert" className="mt-4 text-sm text-rose-300">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="mt-8 flex items-center gap-3 text-sm text-slate-400">
            <LoaderCircle className="h-5 w-5 animate-spin text-amber-300" />
            {t('local.loading')}
          </div>
        ) : projects.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
            {t('local.empty')}
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {projects.map((project) => (
              <li
                key={project.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-4"
              >
                <div>
                  <p className="font-medium text-white">{project.name}</p>
                  <p className="text-xs text-slate-500">
                    {t('local.updated', {
                      date: formatDate(project.updatedAt),
                      points: project.drawing.points.length,
                      routes: project.drawing.routes.length,
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/local/${project.id}`)}
                  >
                    {t('local.open')}
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport(project)}
                  >
                    <Download className="h-4 w-4" />
                    JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleSync(project)}
                    disabled={busy}
                  >
                    {user ? t('local.sync') : t('local.signInSync')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleDelete(project)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}