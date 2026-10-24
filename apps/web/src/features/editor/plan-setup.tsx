import {
  FileImage,
  FileText,
  LoaderCircle,
  MousePointer2,
  Upload,
} from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
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
        Plan setup
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-white">
        Start {floorName}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
        Begin with an empty grid or upload an existing floor plan. Uploaded
        files stay private to your account and are served through the API.
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
            Blank plan
          </h3>
          <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-400">
            A clean canvas with a metric grid. Useful when you want to draw the
            room geometry from scratch.
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
            {busy === 'blank' ? 'Creating…' : 'Create blank plan'}
          </Button>
        </article>

        <article className="flex flex-col rounded-xl border border-white/10 bg-slate-950/50 p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5">
            <Upload className="h-5 w-5 text-amber-300" />
          </span>
          <h3 className="mt-4 text-base font-semibold text-white">
            Upload a plan
          </h3>
          <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-400">
            Use a JPG or PNG image, or a PDF page. The underlay can be faded,
            locked, hidden, repositioned, and replaced later.
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
            {busy === 'upload' ? 'Processing…' : 'Choose JPG, PNG, or PDF'}
          </Button>
        </article>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <FileText className="h-3.5 w-3.5" />
        PDF pages are rendered into an image at the resolution needed for
        editing.
        <span
          className={cn(
            'rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px]',
          )}
        >
          Private to your account
        </span>
      </div>
    </section>
  );
}
