import type { PublicProject, PublicProjectMember } from '@drawmyplace/contracts';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowUpRight,
  CircleAlert,
  LoaderCircle,
  PencilRuler,
  Save,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  addProjectMember,
  archiveProject,
  getProject,
  listProjectMembers,
  removeProjectMember,
  restoreProject,
  updateProject,
} from '@/features/projects/projects-api';
import { searchUserByEmail } from '@/features/users/users-api';
import { VariantsPanel } from '@/features/variants/variants-panel';
import { useI18n } from '@/features/i18n/i18n-context';
import { WorkspaceHeader } from '@/features/workspace/workspace-header';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

export function ProjectPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { formatDate, t } = useI18n();
  const [project, setProject] = useState<PublicProject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [changingStatus, setChangingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [members, setMembers] = useState<PublicProjectMember[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] =
    useState<PublicProjectMember['role']>('viewer');
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    setLoadError(null);

    void (async () => {
      try {
        const loaded = await getProject(projectId, controller.signal);

        if (!controller.signal.aborted) {
          setProject(loaded);
          setName(loaded.name);
          setDescription(loaded.description ?? '');
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(getErrorMessage(error));
        }
      }
    })();

    return () => controller.abort();
  }, [projectId, reloadToken]);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const loaded = await listProjectMembers(projectId, controller.signal);
        if (!controller.signal.aborted) {
          setMembers(loaded);
        }
      } catch {
        if (!controller.signal.aborted) {
          setMembers([]);
        }
      }
    })();

    return () => controller.abort();
  }, [projectId]);

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMembersError(null);
    setAddingMember(true);
    try {
      const user = await searchUserByEmail(newMemberEmail);
      if (!user) {
        setMembersError(t('project.noUser'));
        return;
      }
      const created = await addProjectMember(projectId, {
        userId: user.id,
        role: newMemberRole,
      });
      setMembers((current) =>
        current.some((m) => m.id === created.id) ? current : [created, ...current],
      );
      setNewMemberEmail('');
    } catch (error) {
      setMembersError(getErrorMessage(error));
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRemoveMember(memberId: string) {
    setMembersError(null);
    try {
      await removeProjectMember(projectId, memberId);
      setMembers((current) => current.filter((m) => m.id !== memberId));
    } catch (error) {
      setMembersError(getErrorMessage(error));
    }
  }

  const dirty =
    project !== null &&
    (name !== project.name || description !== (project.description ?? ''));

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setSaved(false);

    const trimmedName = name.trim();

    if (!trimmedName) {
      setSaveError(t('project.nameRequired'));
      return;
    }

    setSaving(true);

    try {
      const updated = await updateProject(projectId, {
        name: trimmedName,
        description: description.trim() ? description.trim() : null,
      });

      setProject(updated);
      setName(updated.name);
      setDescription(updated.description ?? '');
      setSaved(true);
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (!project) {
      return;
    }

    setChangingStatus(true);
    setStatusError(null);

    try {
      const updated =
        project.status === 'archived'
          ? await restoreProject(project.id)
          : await archiveProject(project.id);

      setProject(updated);
    } catch (error) {
      setStatusError(getErrorMessage(error));
    } finally {
      setChangingStatus(false);
    }
  }

  if (loadError) {
    return (
      <div className="relative min-h-screen">
        <WorkspaceHeader badge={t('project.badge')} />
        <main id="main-content" className="page-shell">
          <div
            role="alert"
            className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-6 text-rose-100"
          >
            <div className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5" />
              <h1 className="text-lg font-semibold">
                {t('project.unableToOpen')}
              </h1>
            </div>
            <p className="mt-2 text-sm text-rose-100/80">{loadError}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setReloadToken((value) => value + 1)}
              >
                {t('project.tryAgain')}
              </Button>
              <Link
                to="/app"
                className="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('project.backToProjects')}
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="relative min-h-screen">
        <WorkspaceHeader badge={t('project.badge')} />
        <div
          role="status"
          className="page-shell flex items-center gap-3 text-sm text-slate-400"
        >
          <LoaderCircle className="h-5 w-5 animate-spin text-amber-300" />
          {t('project.loading')}
        </div>
      </div>
    );
  }

  const archived = project.status === 'archived';

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="app-grid pointer-events-none absolute inset-0 opacity-30" />
      <div className="pointer-events-none absolute -top-48 left-1/2 h-[28rem] w-[48rem] -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />

      <div className="relative">
        <WorkspaceHeader badge={t('project.badge')} />

        <main className="page-shell">
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('project.allProjects')}
          </Link>

          <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {project.name}
                </h1>
                <span
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium capitalize',
                    archived
                      ? 'border-slate-500/30 bg-slate-500/10 text-slate-300'
                      : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
                  )}
                >
                  {t(`status.${project.status}`)}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                {t('project.createdUpdatedRevision', {
                  created: formatDate(project.createdAt),
                  updated: formatDate(project.updatedAt),
                  revision: project.revision,
                })}
              </p>
            </div>

            <Button
              variant="outline"
              onClick={handleToggleStatus}
              disabled={changingStatus}
            >
              {changingStatus ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : archived ? (
                <ArchiveRestore className="h-4 w-4" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              {archived ? t('project.restore') : t('project.archive')}
            </Button>
          </div>

          {statusError ? (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
            >
              {statusError}
            </p>
          ) : null}

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <section className="app-panel p-5">
              <h2 className="text-sm font-semibold text-white">
                {t('project.details')}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                {t('project.detailsHint')}
              </p>

              <form className="mt-5 space-y-4" onSubmit={handleSave}>
                <div className="space-y-1.5">
                  <label
                    htmlFor="project-name"
                    className="block text-xs font-medium tracking-wide text-slate-400 uppercase"
                  >
                    {t('project.name')}
                  </label>
                  <Input
                    id="project-name"
                    name="name"
                    required
                    maxLength={120}
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setSaved(false);
                    }}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="project-description"
                    className="block text-xs font-medium tracking-wide text-slate-400 uppercase"
                  >
                    {t('project.description')}
                  </label>
                  <Textarea
                    id="project-description"
                    name="description"
                    maxLength={2000}
                    placeholder={t('project.descriptionPlaceholder')}
                    value={description}
                    onChange={(event) => {
                      setDescription(event.target.value);
                      setSaved(false);
                    }}
                    disabled={saving}
                  />
                  <p className="text-right text-[11px] text-slate-600">
                    {description.length}/2000
                  </p>
                </div>

                {saveError ? (
                  <p
                    role="alert"
                    className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100"
                  >
                    {saveError}
                  </p>
                ) : null}

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={saving || !dirty}>
                    {saving ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {saving ? t('project.saving') : t('project.saveChanges')}
                  </Button>
                  {saved && !dirty ? (
                    <span className="text-xs text-emerald-300">{t('project.saved')}</span>
                  ) : null}
                </div>
              </form>
            </section>

            <section className="overflow-hidden app-panel">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {t('project.floorPlan')}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {t('project.floorPlanHint')}
                  </p>
                </div>
                <PencilRuler className="h-4 w-4 text-amber-300" />
              </div>

              <div className="relative flex min-h-80 flex-col items-center justify-center p-8 text-center">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 opacity-50 [background-image:linear-gradient(to_right,rgba(148,163,184,0.09)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.09)_1px,transparent_1px)] [background-size:32px_32px]"
                />
                <div className="relative">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/70">
                    <PencilRuler className="h-6 w-6 text-amber-300" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-white">
                    {t('project.planEditor')}
                  </h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-400">
                    {t('project.planEditorHint')}
                  </p>
                  {archived ? (
                    <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                      <CircleAlert className="h-3.5 w-3.5" />
                      {t('project.restoreBeforeEdit')}
                    </p>
                  ) : (
                    <>
                      <Link
                        to={`/app/projects/${project.id}/editor`}
                        className={cn(buttonVariants(), 'mt-5')}
                      >
                        {t('project.openEditor')}
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                      <div>
                        <Link
                          to={`/app/projects/${project.id}/estimates`}
                          className="mt-3 inline-flex items-center gap-1.5 text-sm text-amber-300 hover:text-amber-200"
                        >
                          {t('project.viewEstimates')}
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                        <span className="mx-2 text-slate-600">·</span>
                        <Link
                          to={`/app/projects/${project.id}/documentation`}
                          className="mt-3 inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white"
                        >
                          {t('project.documentation')}
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>

          <section className="mt-6 app-panel p-5">
            <h2 className="text-sm font-semibold text-white">
              {t('project.sharedWith')}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {t('project.sharedHint')}
            </p>
            <form className="mt-4 flex flex-wrap gap-2" onSubmit={handleAddMember}>
              <Input
                type="email"
                value={newMemberEmail}
                onChange={(event) => setNewMemberEmail(event.target.value)}
                placeholder="member@example.com"
                required
                className="min-w-56 flex-1"
              />
              <select
                value={newMemberRole}
                onChange={(event) =>
                  setNewMemberRole(event.target.value as PublicProjectMember['role'])
                }
                className="h-10 rounded-lg border border-white/10 bg-slate-950 px-3 text-sm text-slate-200"
              >
                <option value="viewer">{t('role.viewer')}</option>
                <option value="electrician">{t('role.electrician')}</option>
                <option value="manager">{t('role.manager')}</option>
              </select>
              <Button type="submit" disabled={addingMember}>
                {addingMember ? t('project.adding') : t('project.addMember')}
              </Button>
            </form>
            {membersError ? (
              <p role="alert" className="mt-3 text-sm text-rose-300">
                {membersError}
              </p>
            ) : null}
            {members.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                {t('project.noMembers')}
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {members.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/5 px-3 py-2 text-sm"
                  >
                    <span className="text-slate-300">
                      {member.userId}{' '}
                      <span className="text-xs text-amber-300">
                        {t(`role.${member.role}`)}
                      </span>
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      {t('project.remove')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <VariantsPanel projectId={projectId} />
        </main>
      </div>
    </div>
  );
}
