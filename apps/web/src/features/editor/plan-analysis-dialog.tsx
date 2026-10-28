import { LoaderCircle, Ruler, ScanLine, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { useI18n } from '@/features/i18n/i18n-context';
import {
  analysisAreaSquareMeters,
  type PlanAnalysis,
} from './plan-analysis';

interface PlanAnalysisDialogProps {
  open: boolean;
  busy: boolean;
  error: string | null;
  result: PlanAnalysis | null;
  existingWalls: number;
  existingRooms: number;
  existingOpenings: number;
  metersPerUnit: number | null;
  canAbort?: boolean;
  onCancel: () => void;
  onCalibrate?: () => void;
  onConfirm: (replaceExisting: boolean) => void;
}

export function PlanAnalysisDialog({
  open,
  busy,
  error,
  result,
  existingWalls,
  existingRooms,
  existingOpenings,
  metersPerUnit,
  canAbort = false,
  onCancel,
  onCalibrate,
  onConfirm,
}: PlanAnalysisDialogProps) {
  const { t } = useI18n();
  const [replaceExisting, setReplaceExisting] = useState(false);
  const hasExisting = existingWalls + existingRooms > 0;

  useEffect(() => {
    if (open) {
      setReplaceExisting(hasExisting);
    }
  }, [open, hasExisting]);

  const area = result ? analysisAreaSquareMeters(result, metersPerUnit) : null;
  const wallLength = result
    ? result.walls.reduce((sum, wall) => {
        const [from, to] = wall.geometry;

        if (!from || !to) return sum;

        return sum + Math.hypot(to.x - from.x, to.y - from.y);
      }, 0) * (metersPerUnit ?? 1)
    : 0;

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) onCancel();
      }}
      title={t('editor.analysis.title')}
      description={t('editor.analysis.hint')}
      className="max-w-2xl"
      closeLabel={t('editor.close')}
      footer={
        <>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={busy && !canAbort}
          >
            {t('editor.cancel')}
          </Button>
          <Button
            onClick={() => onConfirm(replaceExisting)}
            disabled={busy || !result || result.rooms.length + result.walls.length === 0}
          >
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <ScanLine className="h-4 w-4" />
            )}
            {t('editor.analysis.confirm')}
          </Button>
        </>
      }
    >
      {busy ? (
        <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground">
          <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
          {t('editor.analysis.running')}
        </div>
      ) : null}

      {!busy && error ? (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {!busy && !error && result ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <img
              src={result.preview}
              alt={t('editor.analysis.previewAlt')}
              className="max-h-72 w-full object-contain"
            />
          </div>

          {result.rooms.length === 0 && result.walls.length > 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-700 dark:text-amber-200">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t('editor.analysis.noRooms')}</span>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-muted/30 px-2 py-2.5">
              <p className="text-lg font-semibold text-foreground">
                {result.rooms.length}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {t('editor.analysis.rooms')}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-2 py-2.5">
              <p className="text-lg font-semibold text-foreground">
                {result.walls.length}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {t('editor.analysis.walls')}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-2 py-2.5">
              <p className="text-lg font-semibold text-foreground">
                {result.openings.length}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {t('editor.analysis.openings')}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-2 py-2.5">
              <p className="text-lg font-semibold text-foreground">
                {area === null
                  ? wallLength.toFixed(0)
                  : `${area.toFixed(1)} m²`}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {area === null
                  ? t('editor.analysis.wallLengthUnits')
                  : t('editor.analysis.area')}
              </p>
            </div>
          </div>

          {metersPerUnit === null ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {t('editor.analysis.uncalibrated')}
              </p>
              {onCalibrate ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCalibrate}
                  disabled={busy}
                >
                  <Ruler className="h-3.5 w-3.5" />
                  {t('editor.analysis.calibrate')}
                </Button>
              ) : null}
            </div>
          ) : null}

          {hasExisting ? (
            <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
              <label className="flex cursor-pointer items-start gap-2 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(event) => setReplaceExisting(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                />
                <span>
                  {t('editor.analysis.replace')}
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {t('editor.analysis.replaceHint', {
                      walls: existingWalls,
                      rooms: existingRooms,
                    })}
                    {existingOpenings > 0
                      ? ` ${t('editor.analysis.replaceOpenings', {
                          count: existingOpenings,
                        })}`
                      : ''}
                  </span>
                </span>
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      {!busy && !error && !result ? (
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
          {t('editor.analysis.noImage')}
        </div>
      ) : null}
    </Dialog>
  );
}
