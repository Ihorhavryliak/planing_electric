import type { PublicProjectTemplate } from '@drawmyplace/contracts';
import {
  Cable,
  DoorOpen,
  FilePlus2,
  LayoutTemplate,
  LoaderCircle,
  Plug,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-context';
import { cn } from '@/lib/utils';
import { templateText } from './template-text';

interface TemplatePickerProps {
  templates: PublicProjectTemplate[] | null;
  error: string | null;
  actionError?: string | null;
  busyCode: string | null;
  onUse: (template: PublicProjectTemplate) => void;
  onBlank: () => void;
}

function previewSource(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function TemplateCard({
  template,
  busy,
  onUse,
}: {
  template: PublicProjectTemplate;
  busy: boolean;
  onUse: () => void;
}) {
  const { t, locale } = useI18n();
  const name = templateText(template, 'name', t, locale);
  const description = templateText(template, 'description', t, locale);

  return (
    <button
      type="button"
      onClick={onUse}
      disabled={busy}
      aria-label={`${name} — ${t('templates.use')}`}
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] text-left transition',
        'hover:border-[var(--dmp-color-brand)]/60 hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-[var(--dmp-color-brand)]/40 focus-visible:outline-none',
        'disabled:cursor-progress disabled:opacity-60',
      )}
    >
      <div className="flex aspect-[4/3] w-full items-center justify-center border-b border-white/10 bg-slate-950/60 p-3">
        <img
          src={previewSource(template.previewSvg)}
          alt=""
          className="h-full w-full object-contain"
          loading="lazy"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="text-sm font-semibold text-white">{name}</p>
        <p className="text-xs leading-relaxed text-slate-400">
          {description}
        </p>
        <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <DoorOpen className="h-3.5 w-3.5" />
            {template.roomsCount} {t('templates.rooms')}
          </span>
          <span className="inline-flex items-center gap-1">
            <Plug className="h-3.5 w-3.5" />
            {template.devicesCount} {t('templates.devices')}
          </span>
          <span className="inline-flex items-center gap-1">
            <Cable className="h-3.5 w-3.5" />
            {template.circuitsCount} {t('templates.circuits')}
          </span>
        </div>
        <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--dmp-color-brand)]">
          {busy ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <LayoutTemplate className="h-3.5 w-3.5" />
          )}
          {busy ? t('templates.using') : t('templates.use')}
        </span>
      </div>
    </button>
  );
}

export function TemplatePicker({
  templates,
  error,
  actionError = null,
  busyCode,
  onUse,
  onBlank,
}: TemplatePickerProps) {
  const { t } = useI18n();

  return (
    <section className="app-panel mt-8 p-5 sm:p-6" data-testid="template-picker">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">
            {t('templates.title')}
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-400">
            {t('templates.subtitle')}
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400 tabular-nums">
          {templates?.length ?? 0}
        </span>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {t('templates.unavailable')} {error}
          </span>
        </div>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      ) : null}

      {!error && templates === null ? (
        <div
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          aria-busy="true"
        >
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-64 animate-pulse rounded-xl border border-white/10 bg-white/[0.03]"
            />
          ))}
          <span className="sr-only">{t('templates.loading')}</span>
        </div>
      ) : null}

      {templates && templates.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              busy={busyCode === template.code}
              onUse={() => onUse(template)}
            />
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-2.5">
        <p className="text-xs text-slate-400">{t('templates.blankHint')}</p>
        <Button variant="outline" size="sm" onClick={onBlank}>
          <FilePlus2 className="h-4 w-4" />
          {t('templates.blank')}
        </Button>
      </div>
    </section>
  );
}
