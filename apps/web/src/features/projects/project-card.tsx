import type { PublicProject } from '@drawmyplace/contracts';
import {
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  LoaderCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-context';
import { cn } from '@/lib/utils';

interface ProjectCardProps {
  project: PublicProject;
  busy: boolean;
  onToggleStatus: (project: PublicProject) => void;
}

export function ProjectCard({
  project,
  busy,
  onToggleStatus,
}: ProjectCardProps) {
  const { formatDate, t } = useI18n();
  const archived = project.status === 'archived';

  return (
    <article
      className={cn(
        'flex h-full flex-col app-panel p-5 transition-colors hover:border-white/20',
        archived && 'bg-slate-900/35',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className={cn(
              'truncate text-base font-semibold text-white',
              archived && 'text-slate-300',
            )}
            title={project.name}
          >
            {project.name}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {t('project.updated', { date: formatDate(project.updatedAt) })}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize',
            archived
              ? 'border-slate-500/30 bg-slate-500/10 text-slate-300'
              : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200',
          )}
        >
          {t(`status.${project.status}`)}
        </span>
      </div>

      <p className="mt-3 line-clamp-3 min-h-10 text-sm leading-relaxed text-slate-400">
        {project.description || t('project.noDescription')}
      </p>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-5">
        <Link
          to={`/app/projects/${project.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-300 hover:text-amber-200"
        >
          {t('project.open')}
          <ArrowUpRight className="h-4 w-4" />
        </Link>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleStatus(project)}
          disabled={busy}
        >
          {busy ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : archived ? (
            <ArchiveRestore className="h-4 w-4" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
          {archived ? t('project.restoreShort') : t('project.archiveShort')}
        </Button>
      </div>
    </article>
  );
}
