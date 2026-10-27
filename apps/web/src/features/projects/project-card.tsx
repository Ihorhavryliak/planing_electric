import type { PublicProjectSummary } from '@drawmyplace/contracts';
import {
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  Cable,
  FolderKanban,
  Layers3,
  LoaderCircle,
  Plug,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-context';
import { cn } from '@/lib/utils';

interface ProjectCardProps {
  project: PublicProjectSummary;
  busy: boolean;
  onToggleStatus: (project: PublicProjectSummary) => void;
}

export function ProjectCard({
  project,
  busy,
  onToggleStatus,
}: ProjectCardProps) {
  const { formatDate, t } = useI18n();
  const archived = project.status === 'archived';
  const thumbnail = project.thumbnailSvg
    ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(project.thumbnailSvg)}`
    : null;

  const stats = [
    {
      key: 'floors',
      label: t('project.floors'),
      value: project.floorCount,
      icon: Layers3,
    },
    {
      key: 'devices',
      label: t('project.devices'),
      value: project.pointCount,
      icon: Plug,
    },
    {
      key: 'routes',
      label: t('project.routes'),
      value: project.routeCount,
      icon: Cable,
    },
    {
      key: 'circuits',
      label: t('project.circuits'),
      value: project.circuitCount,
      icon: Zap,
    },
  ] as const;

  return (
    <article
      className={cn(
        'flex h-full flex-col overflow-hidden app-panel transition-colors hover:border-white/20',
        archived && 'bg-slate-900/35',
      )}
    >
      <div className="relative aspect-[16/8] overflow-hidden border-b border-white/10 bg-slate-950/40">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-900/60 to-slate-950/80">
            <FolderKanban className="h-10 w-10 text-slate-600" />
          </div>
        )}
        <span
          className={cn(
            'absolute top-2 right-2 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize backdrop-blur',
            archived
              ? 'border-slate-500/30 bg-slate-900/80 text-slate-300'
              : 'border-emerald-400/25 bg-emerald-950/80 text-emerald-200',
          )}
        >
          {t(`status.${project.status}`)}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
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

        <p className="mt-2.5 line-clamp-2 min-h-9 text-sm leading-relaxed text-slate-400">
          {project.description || t('project.noDescription')}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {stats.map(({ key, label, value, icon: Icon }) => (
            <span
              key={key}
              title={label}
              className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-slate-300"
            >
              <Icon className="h-3 w-3 text-slate-500" />
              <span className="tabular-nums">{value}</span>
              <span className="text-slate-500">{label}</span>
            </span>
          ))}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4">
          <Link
            to={`/app/projects/${project.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--dmp-color-brand)] hover:underline"
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
      </div>
    </article>
  );
}
