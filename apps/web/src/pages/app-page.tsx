import type { PublicProject } from '@drawmyplace/contracts';
import {
  FolderKanban,
  FolderOpen,
  FolderPlus,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CardSkeleton } from '@/components/ui/skeleton';
import { ProjectCard } from '@/features/projects/project-card';
import {
  archiveProject,
  createProject,
  listProjects,
  restoreProject,
} from '@/features/projects/projects-api';
import { useI18n } from '@/features/i18n/i18n-context';
import { WorkspaceHeader } from '@/features/workspace/workspace-header';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

type ProjectTab = 'active' | 'archived';

const projectTabs: Array<{ value: ProjectTab; labelKey: string }> = [
  { value: 'active', labelKey: 'app.tabActive' },
  { value: 'archived', labelKey: 'app.tabArchived' },
];

export function AppPage() {
  const { t } = useI18n();
  const [projects, setProjects] = useState<PublicProject[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [tab, setTab] = useState<ProjectTab>('active');

  const nameInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [busyProjectId, setBusyProjectId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setListError(null);

    void (async () => {
      try {
        const loaded = await listProjects('all', controller.signal);

        if (!controller.signal.aborted) {
          setProjects(loaded);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setListError(getErrorMessage(error));
        }
      }
    })();

    return () => controller.abort();
  }, [reloadToken]);

  const activeProjects = projects?.filter((project) => project.status === 'active') ?? [];
  const archivedProjects =
    projects?.filter((project) => project.status === 'archived') ?? [];
  const visibleProjects =
    tab === 'active' ? activeProjects : archivedProjects;

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    setCreating(true);

    try {
      const created = await createProject({
        name,
        description: description.trim() ? description : undefined,
      });

      setProjects((current) => (current ? [created, ...current] : [created]));
      setName('');
      setDescription('');
      setTab('active');
    } catch (error) {
      setCreateError(getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleStatus(project: PublicProject) {
    setBusyProjectId(project.id);
    setActionError(null);

    try {
      const updated =
        project.status === 'archived'
          ? await restoreProject(project.id)
          : await archiveProject(project.id);

      setProjects((current) =>
        current
          ? current.map((item) => (item.id === updated.id ? updated : item))
          : current,
      );
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setBusyProjectId(null);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="app-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute -top-48 left-1/2 h-[30rem] w-[52rem] -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />

      <div className="relative">
        <WorkspaceHeader />

        <main id="main-content" className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium tracking-widest text-amber-300/80 uppercase">
                {t('app.projects')}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {t('app.title')}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                {t('app.subtitle')}
              </p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
              <FolderKanban className="h-4 w-4 text-amber-300" />
              <span>
                <strong className="font-semibold text-white">
                  {activeProjects.length}
                </strong>{' '}
                {t('app.activeWord')}
              </span>
              <span className="text-slate-600">·</span>
              <span>
                {t('app.archivedCount', { count: archivedProjects.length })}
              </span>
            </div>
          </div>

          <section className="mt-8 app-panel p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <FolderPlus className="h-4 w-4 text-amber-300" />
              <h2 className="text-sm font-semibold text-white">
                {t('app.newProject')}
              </h2>
            </div>

            <form
              className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-start"
              onSubmit={handleCreate}
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="project-name"
                  className="block text-xs font-medium tracking-wide text-slate-400 uppercase"
                >
                  {t('app.projectName')}
                </label>
                <Input
                  ref={nameInputRef}
                  id="project-name"
                  name="name"
                  placeholder={t('app.namePlaceholder')}
                  required
                  maxLength={120}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={creating}
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="project-description"
                  className="block text-xs font-medium tracking-wide text-slate-400 uppercase"
                >
                  {t('app.description')}{' '}
                  <span className="normal-case">{t('app.optional')}</span>
                </label>
                <Textarea
                  id="project-description"
                  name="description"
                  placeholder={t('project.descriptionPlaceholder')}
                  maxLength={2000}
                  rows={1}
                  className="min-h-10 resize-none py-2"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  disabled={creating}
                />
              </div>

              <Button
                type="submit"
                className="md:mt-6"
                disabled={creating || !name.trim()}
              >
                {creating ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderPlus className="h-4 w-4" />
                )}
                {creating ? t('app.creating') : t('app.create')}
              </Button>
            </form>

            {createError ? (
              <p
                role="alert"
                className="mt-4 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100"
              >
                {createError}
              </p>
            ) : null}
          </section>

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <div
              className="inline-flex rounded-xl border border-white/10 bg-slate-900/60 p-1"
              role="tablist"
              aria-label={t('app.statusAria')}
            >
              {projectTabs.map((item) => {
                const count =
                  item.value === 'active'
                    ? activeProjects.length
                    : archivedProjects.length;

                return (
                  <button
                    key={item.value}
                    type="button"
                    role="tab"
                    aria-selected={tab === item.value}
                    onClick={() => setTab(item.value)}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                      tab === item.value
                        ? 'bg-[var(--dmp-color-brand)] text-white'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    {t(item.labelKey)}
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[11px]',
                        tab === item.value
                          ? 'bg-slate-950/15 text-slate-900'
                          : 'bg-white/10 text-slate-400',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReloadToken((value) => value + 1)}
              disabled={projects === null && !listError}
            >
              <RefreshCw className="h-4 w-4" />
              {t('app.refresh')}
            </Button>
          </div>

          {actionError ? (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
            >
              {actionError}
            </p>
          ) : null}

          {listError ? (
            <div
              role="alert"
              className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
            >
              <span className="inline-flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 shrink-0" />
                {listError}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReloadToken((value) => value + 1)}
              >
                {t('app.tryAgain')}
              </Button>
            </div>
          ) : null}

          {projects === null && !listError ? (
            <div
              role="status"
              aria-label={t('app.loading')}
              className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : null}

          {projects !== null && visibleProjects.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/15 bg-slate-900/35 px-6 py-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <FolderOpen className="h-5 w-5 text-slate-400" />
              </span>
              <h2 className="mt-4 text-base font-semibold text-white">
                {tab === 'active'
                  ? t('app.noActive')
                  : t('app.noArchived')}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
                {tab === 'active'
                  ? t('app.noActiveHint')
                  : t('app.noArchivedHint')}
              </p>
              {tab === 'active' ? (
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
                    <FolderPlus className="h-4 w-4" />
                    {t('app.emptyCta')}
                  </Button>
                  <Link
                    to="/local"
                    className={cn(buttonVariants({ variant: 'outline' }))}
                  >
                    <Sparkles className="h-4 w-4" />
                    {t('app.emptyDemo')}
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}

          {visibleProjects.length > 0 ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  busy={busyProjectId === project.id}
                  onToggleStatus={handleToggleStatus}
                />
              ))}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
