import {
  FileImage,
  FileText,
  LoaderCircle,
  MousePointer2,
  Upload,
} from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-context';
import { cn } from '@/lib/utils';

interface PlanSetupProps {
  floorName: string;
  busy: 'blank' | 'upload' | null;
  error: string | null;
  onBlank: () => void;
  onFile: (file: File) => void;
}

export function PlanSetup({
  floorName,
  busy,
  error,
  onBlank,
  onFile,
}: PlanSetupProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (file) {
      onFile(file);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 sm:p-6">
      <p className="text-xs font-medium tracking-widest text-amber-300/80 uppercase">
        {t('setup.kicker')}
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-white">
        {t('setup.title', { floor: floorName })}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
        {t('setup.subtitle')}
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <article className="flex flex-col rounded-xl border border-white/10 bg-slate-950/50 p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5">
            <MousePointer2 className="h-5 w-5 text-amber-300" />
          </span>
          <h3 className="mt-4 text-base font-semibold text-white">
            {t('setup.blank')}
          </h3>
          <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-400">
            {t('setup.blankHint')}
          </p>
          <Button
            className="mt-5"
            onClick={onBlank}
            disabled={busy !== null}
          >
            {busy === 'blank' ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <MousePointer2 className="h-4 w-4" />
            )}
            {busy === 'blank' ? t('editorPage.creating') : t('setup.createBlank')}
          </Button>
        </article>

        <article className="flex flex-col rounded-xl border border-white/10 bg-slate-950/50 p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5">
            <Upload className="h-5 w-5 text-amber-300" />
          </span>
          <h3 className="mt-4 text-base font-semibold text-white">
            {t('setup.upload')}
          </h3>
          <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-400">
            {t('setup.uploadHint')}
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            className="sr-only"
            onChange={handleFileChange}
            disabled={busy !== null}
          />
          <Button
            variant="outline"
            className="mt-5"
            onClick={() => inputRef.current?.click()}
            disabled={busy !== null}
          >
            {busy === 'upload' ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <FileImage className="h-4 w-4" />
            )}
            {busy === 'upload' ? t('setup.processing') : t('setup.choose')}
          </Button>
        </article>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <FileText className="h-3.5 w-3.5" />
        {t('setup.pdfNote')}
        <span
          className={cn(
            'rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px]',
          )}
        >
          {t('setup.private')}
        </span>
      </div>
    </section>
  );
}
