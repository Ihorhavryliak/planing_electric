import type {
  EditorViewport,
  PublicPlan,
  UnderlaySettings,
} from '@drawmyplace/contracts';
import {
  Check,
  Clock3,
  Eye,
  EyeOff,
  FileImage,
  FileText,
  ImagePlus,
  LoaderCircle,
  Lock,
  RotateCcw,
  Save,
  TriangleAlert,
  Unlock,
  Upload,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  loadPlanFile,
  planFileUrl,
  planPreviewUrl,
  replacePlanFile,
  updatePlan,
  uploadPlanPreview,
} from './editor-api';
import { EditorCanvas } from './editor-canvas';
import {
  describeError,
  planUploadKind,
  type PlanUploadKind,
} from './editor-utils';
import { PdfPageDialog } from './pdf-page-dialog';
import { countPdfPages, renderPdfPageToPng } from './pdf-preview';
import {
  usePlanAutosave,
  type AutosaveStatus,
} from './use-plan-autosave';
import { getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

interface PlanEditorProps {
  plan: PublicPlan;
  floorName: string;
  onPlanChange: (plan: PublicPlan) => void;
}

interface PendingPdf {
  file: File;
  pages: number;
}

const saveLabels: Record<AutosaveStatus, string> = {
  saved: 'All changes saved',
  pending: 'Unsaved changes',
  saving: 'Saving…',
  error: 'Save failed',
};

function SaveStatus({
  status,
  error,
  onRetry,
}: {
  status: AutosaveStatus;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-2 text-xs font-medium',
            status === 'saved' && 'text-emerald-300',
            status === 'pending' && 'text-amber-200',
            status === 'saving' && 'text-slate-300',
            status === 'error' && 'text-rose-300',
          )}
          role="status"
          aria-live="polite"
        >
          {status === 'saved' ? (
            <Check className="h-3.5 w-3.5" />
          ) : status === 'saving' ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : status === 'pending' ? (
            <Clock3 className="h-3.5 w-3.5" />
          ) : (
            <TriangleAlert className="h-3.5 w-3.5" />
          )}
          {saveLabels[status]}
        </span>

        {status === 'error' ? (
          <Button variant="ghost" size="sm" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" />
            Retry
          </Button>
        ) : (
          <Save className="h-3.5 w-3.5 text-slate-600" />
        )}
      </div>

      {error ? (
        <p className="mt-2 text-xs leading-relaxed text-rose-200">{error}</p>
      ) : null}
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  displayValue,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs text-slate-400">
        {label}
        <span className="font-medium text-slate-200 tabular-nums">
          {displayValue}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

function OverlayCard({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <div className="pointer-events-auto max-w-sm rounded-2xl border border-white/10 bg-slate-950/95 p-5 text-center shadow-2xl shadow-black/40 backdrop-blur">
        {children}
      </div>
    </div>
  );
}

export function PlanEditor({
  plan,
  floorName,
  onPlanChange,
}: PlanEditorProps) {
  const [underlay, setUnderlay] = useState<UnderlaySettings>(plan.underlay);
  const [viewport, setViewport] = useState<EditorViewport>(plan.viewport);
  const [assetNonce, setAssetNonce] = useState(0);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const [preparingFile, setPreparingFile] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pendingPdf, setPendingPdf] = useState<PendingPdf | null>(null);

  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pageBusy, setPageBusy] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageInput, setPageInput] = useState(String(plan.page ?? 1));

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { status, error: saveError, retry } = usePlanAutosave({
    plan,
    underlay,
    viewport,
    onPlanChange,
  });

  const isPdf = plan.mimeType === 'application/pdf';
  const hasUploadedFile = plan.sourceType === 'upload' && plan.mimeType !== null;
  const imageUrl =
    plan.sourceType === 'upload'
      ? plan.mimeType === 'application/pdf'
        ? plan.hasPreview
          ? planPreviewUrl(plan.id, assetNonce)
          : null
        : planFileUrl(plan.id, assetNonce)
      : null;
  const needsPreview = hasUploadedFile && isPdf && !plan.hasPreview;

  useEffect(() => {
    setPageInput(String(plan.page ?? 1));
  }, [plan.page]);

  useEffect(() => {
    if (!imageUrl) {
      setImage(null);
      setImageLoading(false);
      setImageError(null);
      return;
    }

    let cancelled = false;
    const nextImage = new Image();

    setImage(null);
    setImageLoading(true);
    setImageError(null);

    nextImage.decoding = 'async';
    nextImage.onload = () => {
      if (!cancelled) {
        setImage(nextImage);
        setImageLoading(false);
      }
    };
    nextImage.onerror = () => {
      if (!cancelled) {
        setImage(null);
        setImageLoading(false);
        setImageError('Unable to load the plan image. Try loading it again.');
      }
    };
    nextImage.src = imageUrl;

    return () => {
      cancelled = true;
      nextImage.onload = null;
      nextImage.onerror = null;
    };
  }, [imageUrl]);

  function updateUnderlay(patch: Partial<UnderlaySettings>) {
    setUnderlay((current) => ({ ...current, ...patch }));
  }

  function resetUnderlayTransform() {
    updateUnderlay({
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      rotation: 0,
    });
  }

  async function preparePreview(page: number, source?: Blob) {
    setPreviewBusy(true);
    setPreviewError(null);

    try {
      const fileBlob = source ?? (await loadPlanFile(plan.id));
      const preview = await renderPdfPageToPng(fileBlob, page);
      const updated = await uploadPlanPreview(plan.id, preview);

      onPlanChange(updated);
      setAssetNonce((value) => value + 1);
    } catch (renderError) {
      setPreviewError(describeError(renderError));
    } finally {
      setPreviewBusy(false);
    }
  }

  async function handleApplyPage() {
    const page = Number(pageInput);
    setPageError(null);

    if (!Number.isInteger(page) || page < 1 || page > 1000) {
      setPageError('Enter a whole page number between 1 and 1000.');
      return;
    }

    if (page === plan.page && plan.hasPreview) {
      return;
    }

    if (page === plan.page) {
      await preparePreview(page);
      return;
    }

    setPageBusy(true);

    try {
      const updated = await updatePlan(plan.id, { page });
      onPlanChange(updated);
      await preparePreview(page);
    } catch (updateError) {
      setPageError(getErrorMessage(updateError));
    } finally {
      setPageBusy(false);
    }
  }

  async function performReplace(file: File, page?: number) {
    setPendingPdf(null);
    setReplacing(true);
    setFileError(null);
    setPreviewError(null);

    try {
      const updated = await replacePlanFile(plan.id, file, page);

      setUnderlay((current) => ({
        ...current,
        visible: true,
        locked: false,
        opacity: 1,
        rotation: 0,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      }));
      onPlanChange(updated);
      setAssetNonce((value) => value + 1);

      if (updated.mimeType === 'application/pdf') {
        await preparePreview(updated.page ?? 1, file);
      }
    } catch (replaceError) {
      setFileError(describeError(replaceError));
    } finally {
      setReplacing(false);
    }
  }

  async function handleFileSelected(file: File) {
    setFileError(null);
    setPreviewError(null);

    const kind: PlanUploadKind | null = planUploadKind(file);

    if (!kind) {
      setFileError('Choose a JPG, PNG, or PDF file.');
      return;
    }

    if (kind === 'pdf') {
      setPreparingFile(true);

      try {
        const pages = await countPdfPages(file);
        setPendingPdf({ file, pages });
      } catch (countError) {
        setFileError(
          `Unable to read the PDF: ${describeError(countError)}`,
        );
      } finally {
        setPreparingFile(false);
      }

      return;
    }

    await performReplace(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (file) {
      void handleFileSelected(file);
    }
  }

  async function retryImage() {
    setAssetNonce((value) => value + 1);
  }

  async function retryPreview() {
    if (previewBusy) {
      return;
    }

    await preparePreview(plan.page ?? 1);
  }

  const overlayBusy = previewBusy || imageLoading;
  const overlayError = previewError ?? imageError;

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="relative h-[65vh] min-h-[440px] xl:h-[calc(100vh-12rem)]">
          <EditorCanvas
            image={image}
            underlay={underlay}
            viewport={viewport}
            autoFit={plan.version === 1}
            onUnderlayChange={setUnderlay}
            onViewportChange={setViewport}
          />

          {overlayBusy ? (
            <OverlayCard>
              <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-amber-300" />
              <p className="mt-3 text-sm font-medium text-white">
                {previewBusy ? 'Rendering PDF page…' : 'Loading underlay…'}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                This can take a moment for large drawings.
              </p>
            </OverlayCard>
          ) : null}

          {!overlayBusy && overlayError ? (
            <OverlayCard>
              <TriangleAlert className="mx-auto h-6 w-6 text-rose-300" />
              <p className="mt-3 text-sm font-medium text-white">
                Underlay unavailable
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {overlayError}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={needsPreview ? retryPreview : retryImage}
              >
                <RotateCcw className="h-4 w-4" />
                Try again
              </Button>
            </OverlayCard>
          ) : null}

          {!overlayBusy && !overlayError && needsPreview ? (
            <OverlayCard>
              <FileText className="mx-auto h-6 w-6 text-amber-300" />
              <p className="mt-3 text-sm font-medium text-white">
                PDF preview is not ready
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Render page {plan.page ?? 1} to use it as the plan underlay.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={retryPreview}
              >
                <FileText className="h-4 w-4" />
                Render preview
              </Button>
            </OverlayCard>
          ) : null}
        </div>

        <aside className="space-y-4 xl:max-h-[calc(100vh-12rem)] xl:overflow-y-auto xl:pr-1">
          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <h2 className="text-sm font-semibold text-white">Save state</h2>
            <p className="mt-1 text-xs text-slate-500">
              {floorName} · revision {plan.version}
            </p>
            <div className="mt-3">
              <SaveStatus status={status} error={saveError} onRetry={retry} />
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">Underlay</h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
                {plan.sourceType === 'blank'
                  ? 'Blank'
                  : isPdf
                    ? `PDF · page ${plan.page ?? 1}`
                    : plan.mimeType === 'image/png'
                      ? 'PNG'
                      : 'JPG'}
              </span>
            </div>

            {plan.sourceType === 'blank' ? (
              <div className="mt-3 rounded-xl border border-dashed border-white/15 bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-400">
                This is a blank plan. Add a JPG, PNG, or PDF page as an
                optional underlay at any time.
              </div>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateUnderlay({ visible: !underlay.visible })
                    }
                  >
                    {underlay.visible ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                    {underlay.visible ? 'Visible' : 'Hidden'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateUnderlay({ locked: !underlay.locked })
                    }
                  >
                    {underlay.locked ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <Unlock className="h-4 w-4" />
                    )}
                    {underlay.locked ? 'Locked' : 'Unlocked'}
                  </Button>
                </div>

                <div className="mt-4 space-y-4">
                  <RangeControl
                    label="Opacity"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={underlay.opacity}
                    displayValue={`${Math.round(underlay.opacity * 100)}%`}
                    onChange={(opacity) => updateUnderlay({ opacity })}
                  />
                  <RangeControl
                    label="Scale"
                    min={0.1}
                    max={10}
                    step={0.05}
                    value={underlay.scale}
                    displayValue={`${underlay.scale.toFixed(2)}×`}
                    onChange={(scale) => updateUnderlay({ scale })}
                  />
                  <RangeControl
                    label="Rotation"
                    min={-180}
                    max={180}
                    step={1}
                    value={underlay.rotation}
                    displayValue={`${Math.round(underlay.rotation)}°`}
                    onChange={(rotation) => updateUnderlay({ rotation })}
                  />
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={resetUnderlayTransform}
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset position, scale, rotation
                </Button>
              </>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              className="sr-only"
              onChange={handleFileChange}
              disabled={replacing || preparingFile}
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={replacing || preparingFile}
            >
              {replacing || preparingFile ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : plan.sourceType === 'blank' ? (
                <ImagePlus className="h-4 w-4" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {plan.sourceType === 'blank'
                ? 'Add underlay'
                : 'Replace plan file'}
            </Button>

            {fileError ? (
              <p
                role="alert"
                className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs leading-relaxed text-rose-100"
              >
                {fileError}
              </p>
            ) : null}
          </section>

          {isPdf ? (
            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-300" />
                <h2 className="text-sm font-semibold text-white">
                  PDF page
                </h2>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Changing the page re-renders the underlay. Unsaved page changes
                are discarded.
              </p>

              <div className="mt-3 flex items-end gap-2">
                <label className="flex-1">
                  <span className="block text-xs text-slate-400">Page</span>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    step={1}
                    value={pageInput}
                    onChange={(event) => setPageInput(event.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 px-2 text-sm text-slate-100 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
                    disabled={pageBusy || previewBusy}
                  />
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleApplyPage()}
                  disabled={
                    pageBusy ||
                    previewBusy ||
                    pageInput === String(plan.page ?? 1) && plan.hasPreview
                  }
                >
                  {pageBusy || previewBusy ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileImage className="h-4 w-4" />
                  )}
                  Apply
                </Button>
              </div>

              {pageError ? (
                <p
                  role="alert"
                  className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs text-rose-100"
                >
                  {pageError}
                </p>
              ) : null}

              {previewError ? (
                <div className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-xs leading-relaxed text-rose-100">
                  <p>{previewError}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => void retryPreview()}
                    disabled={previewBusy}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Retry render
                  </Button>
                </div>
              ) : null}

              {!plan.hasPreview && !previewBusy ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => void retryPreview()}
                >
                  <FileText className="h-4 w-4" />
                  Render page {plan.page ?? 1}
                </Button>
              ) : null}
            </section>
          ) : null}
        </aside>
      </div>

      {pendingPdf ? (
        <PdfPageDialog
          fileName={pendingPdf.file.name}
          pageCount={pendingPdf.pages}
          initialPage={plan.page ?? 1}
          busy={replacing}
          onCancel={() => setPendingPdf(null)}
          onConfirm={(page) => void performReplace(pendingPdf.file, page)}
        />
      ) : null}
    </>
  );
}
