import { FileText, LoaderCircle, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PdfPageDialogProps {
  fileName: string;
  pageCount: number;
  initialPage?: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (page: number) => void;
}

export function PdfPageDialog({
  fileName,
  pageCount,
  initialPage = 1,
  busy,
  onCancel,
  onConfirm,
}: PdfPageDialogProps) {
  const [page, setPage] = useState(
    String(Math.min(Math.max(1, initialPage), pageCount)),
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onCancel]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = Number(page);

    if (!Number.isInteger(value) || value < 1 || value > pageCount) {
      return;
    }

    onConfirm(value);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-page-title"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl shadow-black/50"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10">
              <FileText className="h-5 w-5 text-amber-300" />
            </span>
            <div>
              <h2
                id="pdf-page-title"
                className="text-base font-semibold text-white"
              >
                Choose a PDF page
              </h2>
              <p className="mt-1 max-w-xs truncate text-xs text-slate-400">
                {fileName} · {pageCount}{' '}
                {pageCount === 1 ? 'page' : 'pages'}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            disabled={busy}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label
              htmlFor="pdf-page"
              className="block text-xs font-medium tracking-wide text-slate-400 uppercase"
            >
              Page number
            </label>
            <Input
              ref={inputRef}
              id="pdf-page"
              name="page"
              type="number"
              min={1}
              max={pageCount}
              step={1}
              required
              value={page}
              onChange={(event) => setPage(event.target.value)}
              disabled={busy}
            />
            <p className="text-xs text-slate-500">
              The selected page is rendered into the plan underlay. You can
              change it later in the editor sidebar.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={busy}
              type="button"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {busy ? 'Uploading…' : 'Use this page'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
