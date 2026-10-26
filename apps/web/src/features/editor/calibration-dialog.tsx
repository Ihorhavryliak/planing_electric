import type { LengthUnitInput, PublicCalibration } from '@drawmyplace/contracts';
import { LoaderCircle, Ruler, TriangleAlert, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/features/i18n/i18n-context';
import {
  distanceBetween,
  previewMetersPerUnit,
  type Vec2,
} from './editor-geometry';

const UNITS: LengthUnitInput[] = ['m', 'cm', 'mm'];
const MAX_DISTANCE = 100_000;

interface CalibrationDialogProps {
  pointA: Vec2;
  pointB: Vec2;
  existing: PublicCalibration | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (realDistance: number, unit: LengthUnitInput) => void;
}

export function CalibrationDialog({
  pointA,
  pointB,
  existing,
  busy,
  error,
  onCancel,
  onConfirm,
}: CalibrationDialogProps) {
  const { t, formatScale } = useI18n();
  const [distance, setDistance] = useState('');
  const [unit, setUnit] = useState<LengthUnitInput>(existing?.unit ?? 'm');
  const inputRef = useRef<HTMLInputElement>(null);

  const value = Number(distance);
  const valid =
    distance.trim() !== '' &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_DISTANCE;
  const scale = valid ? previewMetersPerUnit(pointA, pointB, value, unit) : null;
  const drawingDistance = distanceBetween(pointA, pointB);

  useEffect(() => {
    inputRef.current?.focus();
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

    if (valid && scale !== null && !busy) {
      onConfirm(value, unit);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="calibration-title"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl shadow-black/50"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/10">
              <Ruler className="h-5 w-5 text-amber-300" />
            </span>
            <div>
              <h2
                id="calibration-title"
                className="text-base font-semibold text-white"
              >
                {t('editor.calibrationTitle')}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                {t('editor.calibrationIntro', {
                  distance: drawingDistance.toFixed(1),
                })}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={t('editor.close')}
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
              htmlFor="calibration-distance"
              className="block text-xs font-medium tracking-wide text-slate-400 uppercase"
            >
              {t('editor.realDistance')}
            </label>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                id="calibration-distance"
                name="distance"
                type="number"
                inputMode="decimal"
                min={0}
                max={MAX_DISTANCE}
                step="any"
                required
                value={distance}
                onChange={(event) => setDistance(event.target.value)}
                disabled={busy}
                placeholder={t('editor.distanceExample')}
              />
              <select
                aria-label={t('editor.unit')}
                value={unit}
                onChange={(event) =>
                  setUnit(event.target.value as LengthUnitInput)
                }
                disabled={busy}
                className="h-10 rounded-lg border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20 focus:outline-none"
              >
                {UNITS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500" aria-live="polite">
              {distance.trim() !== '' && !valid
                ? t('editor.distanceInvalid', {
                    max: MAX_DISTANCE.toLocaleString(),
                  })
                : scale !== null
                  ? t('editor.resultingScale', { scale: formatScale(scale) })
                  : t('editor.scaleHint')}
            </p>
          </div>

          {existing ? (
            <p className="flex gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 p-2.5 text-xs leading-relaxed text-amber-100">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t('editor.recalibrateWarning')}
            </p>
          ) : null}

          {error ? (
            <p className="text-xs leading-relaxed text-rose-300" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={busy}
              type="button"
            >
              {t('editor.cancel')}
            </Button>
            <Button type="submit" disabled={busy || !valid || scale === null}>
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Ruler className="h-4 w-4" />
              )}
              {busy ? t('editor.saving') : t('editor.setScale')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
