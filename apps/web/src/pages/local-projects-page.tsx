import {
  ArrowUpRight,
  Download,
  LoaderCircle,
  Plus,
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
import { createBlankPlan, createFloor } from '@/features/editor/editor-api';
import { createProject } from '@/features/projects/projects-api';
import {
  createLocalProject,
  deleteLocalProject,
  isLocalProject,
  listLocalProjects,
  saveLocalProject,
  type LocalProject,
} from '@/features/local/local-db';
import { WorkspaceHeader } from '@/features/workspace/workspace-header';
import { getErrorMessage } from '@/lib/api';

export function LocalProjectsPage() {
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
      const project = createLocalProject(name.trim() || 'Local project');
      await saveLocalProject(project);
      setName('');
      navigate(`/local/${project.id}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(project: LocalProject) {
    if (!window.confirm(`Delete "${project.name}" from this browser?`)) return;
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
      const parsed: unknown = JSON.parse(await file.text());
      if (!isLocalProject(parsed)) {
        setError('That file is not a DrawMyPlace local project.');
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
      setError(err instanceof Error ? err.message : 'Import failed');
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
      <WorkspaceHeader badge="Local mode" />
      <main id="main-content" className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Local projects
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Work without an account. Projects stay in this browser until you
              export or sync them.
            </p>
          </div>
          {user ? (
            <Link to="/app" className="text-sm text-amber-300">
              Go to workspace
            </Link>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm text-amber-300"
            >
              <UserRound className="h-4 w-4" />
              Sign in to sync
            </Link>
          )}
        </div>

        <form className="mt-6 flex flex-wrap gap-2" onSubmit={handleCreate}>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New local project"
            className="min-w-56 flex-1"
          />
          <Button type="submit" disabled={busy}>
            <Plus className="h-4 w-4" />
            Create
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            Import JSON
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
            Loading local projects…
          </div>
        ) : projects.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
            No local projects yet.
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
                    Updated {new Date(project.updatedAt).toLocaleString()} ·{' '}
                    {project.drawing.points.length} points ·{' '}
                    {project.drawing.routes.length} routes
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/local/${project.id}`)}
                  >
                    Open
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
                    {user ? 'Sync to account' : 'Sign in to sync'}
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