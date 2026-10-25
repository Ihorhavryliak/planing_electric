import type { PublicFloor, PublicPlan, PublicProject } from '@drawmyplace/contracts';
import {
  ArrowLeft,
  ChevronRight,
  FolderPlus,
  Layers,
  LoaderCircle,
  Plus,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createBlankPlan,
  createFloor,
  listFloors,
  uploadPlanFile,
} from '@/features/editor/editor-api';
import { PlanEditor } from '@/features/editor/plan-editor';
import { PlanSetup } from '@/features/editor/plan-setup';
import { getProject } from '@/features/projects/projects-api';
import { WorkspaceHeader } from '@/features/workspace/workspace-header';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

function planLabel(plan: PublicPlan | null): string {
  if (!plan) {
    return 'No plan';
  }

  return plan.sourceType === 'blank' ? 'Blank plan' : 'Uploaded plan';
}

export function EditorPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<PublicProject | null>(null);
  const [floors, setFloors] = useState<PublicFloor[] | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [floorName, setFloorName] = useState('Floor 1');
  const [addingFloor, setAddingFloor] = useState(false);
  const [floorBusy, setFloorBusy] = useState(false);
  const [floorError, setFloorError] = useState<string | null>(null);

  const [setupBusy, setSetupBusy] = useState<'blank' | 'upload' | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setLoadError(null);

    void (async () => {
      try {
        const [loadedProject, loadedFloors] = await Promise.all([
          getProject(projectId, controller.signal),
          listFloors(projectId, controller.signal),
        ]);

        if (!controller.signal.aborted) {
          setProject(loadedProject);
          setFloors(loadedFloors);
          setFloorName(`Floor ${loadedFloors.length + 1}`);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(getErrorMessage(error));
        }
      }
    })();

    return () => controller.abort();
  }, [projectId]);

  useEffect(() => {
    if (!floors) {
      return;
    }

    setSelectedFloorId((current) =>
      current && floors.some((floor) => floor.id === current)
        ? current
        : (floors[0]?.id ?? null),
    );
  }, [floors]);

  const selectedFloor =
    floors?.find((floor) => floor.id === selectedFloorId) ?? null;

  function replaceFloor(updated: PublicFloor) {
    setFloors((current) =>
      current
        ? current.map((floor) => (floor.id === updated.id ? updated : floor))
        : [updated],
    );
  }

  async function handleCreateFloor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFloorError(null);
    setFloorBusy(true);

    try {
      const created = await createFloor(projectId, { name: floorName.trim() });

      setFloors((current) => [...(current ?? []), created]);
      setSelectedFloorId(created.id);
      setAddingFloor(false);
      setFloorName(`Floor ${(floors?.length ?? 0) + 2}`);
    } catch (error) {
      setFloorError(getErrorMessage(error));
    } finally {
      setFloorBusy(false);
    }
  }

  function handlePlanChange(plan: PublicPlan) {
    if (!selectedFloor) {
      return;
    }

    replaceFloor({ ...selectedFloor, plan });
  }

  async function handleCreateBlank() {
    if (!selectedFloor) {
      return;
    }

    setSetupBusy('blank');
    setSetupError(null);

    try {
      const plan = await createBlankPlan(selectedFloor.id);
      replaceFloor({ ...selectedFloor, plan });
    } catch (error) {
      setSetupError(getErrorMessage(error));
    } finally {
      setSetupBusy(null);
    }
  }

  async function handleUpload(file: File) {
    if (!selectedFloor) {
      return;
    }

    setSetupBusy('upload');
    setSetupError(null);

    try {
      // PDF page 1 is used first; the page can be changed in the editor.
      const plan = await uploadPlanFile(selectedFloor.id, file, 1);
      replaceFloor({ ...selectedFloor, plan });
    } catch (error) {
      setSetupError(getErrorMessage(error));
    } finally {
      setSetupBusy(null);
    }
  }

  if (loadError) {
    return (
      <div className="relative min-h-screen">
        <WorkspaceHeader badge="Editor" />
        <main className="mx-auto max-w-3xl px-6 py-16">
          <div
            role="alert"
            className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-6 text-rose-100"
          >
            <div className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5" />
              <h1 className="text-lg font-semibold">Unable to open the editor</h1>
            </div>
            <p className="mt-2 text-sm text-rose-100/80">{loadError}</p>
            <Link
              to="/app"
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to projects
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!project || floors === null) {
    return (
      <div className="relative min-h-screen">
        <WorkspaceHeader badge="Editor" />
        <div
          role="status"
          className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-16 text-sm text-slate-400"
        >
          <LoaderCircle className="h-5 w-5 animate-spin text-amber-300" />
          Loading editor…
        </div>
      </div>
    );
  }

  const archived = project.status === 'archived';

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="app-grid pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative">
        <WorkspaceHeader badge="Editor" />

        <main className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link
                to={`/app/projects/${projectId}`}
                className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Project details
              </Link>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  {project.name}
                </h1>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-200">
                  Plan editor
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddingFloor((value) => !value)}
              disabled={archived}
            >
              <Plus className="h-4 w-4" />
              Add floor
            </Button>
          </div>

          {archived ? (
            <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm text-amber-100">
              This project is archived. Restore it from the project page before
              editing the plan.
            </div>
          ) : null}

          {addingFloor || floors.length === 0 ? (
            <form
              className="mt-5 flex flex-wrap items-end gap-2 rounded-2xl border border-white/10 bg-slate-900/60 p-4"
              onSubmit={handleCreateFloor}
            >
              <label className="min-w-52 flex-1">
                <span className="block text-xs font-medium tracking-wide text-slate-400 uppercase">
                  Floor name
                </span>
                <Input
                  value={floorName}
                  onChange={(event) => setFloorName(event.target.value)}
                  placeholder="Floor 1"
                  maxLength={80}
                  disabled={floorBusy || archived}
                  className="mt-1.5"
                />
              </label>
              <Button type="submit" disabled={floorBusy || archived || !floorName.trim()}>
                {floorBusy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderPlus className="h-4 w-4" />
                )}
                {floorBusy ? 'Creating…' : 'Create floor'}
              </Button>
            </form>
          ) : null}

          {floorError ? (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100"
            >
              {floorError}
            </p>
          ) : null}

          {floors.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-slate-900/35 px-6 py-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <Layers className="h-5 w-5 text-slate-400" />
              </span>
              <h2 className="mt-4 text-base font-semibold text-white">
                Start with a floor
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
                A floor holds one plan. Create it above, then choose a blank
                canvas or upload a JPG, PNG, or PDF.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                {floors.map((floor) => (
                  <button
                    key={floor.id}
                    type="button"
                    onClick={() => setSelectedFloorId(floor.id)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                      floor.id === selectedFloorId
                        ? 'border-amber-400/40 bg-amber-400/10 text-amber-100'
                        : 'border-white/10 bg-slate-900/50 text-slate-300 hover:bg-white/5',
                    )}
                  >
                    <span>
                      <span className="block font-medium">{floor.name}</span>
                      <span className="block text-[11px] text-slate-500">
                        {planLabel(floor.plan)}
                      </span>
                    </span>
                    {floor.id === selectedFloorId ? (
                      <ChevronRight className="h-4 w-4 text-amber-300" />
                    ) : null}
                  </button>
                ))}
              </div>

              {selectedFloor ? (
                <div className="mt-6">
                  {selectedFloor.plan ? (
                    <PlanEditor
                      key={selectedFloor.plan.id}
                      plan={selectedFloor.plan}
                      floorName={selectedFloor.name}
                      onPlanChange={handlePlanChange}
                    />
                  ) : (
                    <PlanSetup
                      floorName={selectedFloor.name}
                      busy={setupBusy}
                      error={setupError}
                      onBlank={() => void handleCreateBlank()}
                      onFile={(file) => void handleUpload(file)}
                    />
                  )}
                </div>
              ) : null}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
