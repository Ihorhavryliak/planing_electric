import type { PublicPoint, UpdatePointInput } from '@drawmyplace/contracts';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/features/i18n/i18n-context';

interface PointDetailsDialogProps {
  open: boolean;
  point: PublicPoint | null;
  lengthUnit: 'm' | 'cm' | 'mm';
  onClose: () => void;
  onSave: (id: string, patch: UpdatePointInput) => void;
}

const MOUNT_PRESETS = [
  { id: 'floor', meters: 0.3 },
  { id: 'wall', meters: 1.1 },
  { id: 'ceiling', meters: 2.4 },
] as const;

function presetFor(height: number | null): string {
  if (height === null) return 'wall';
  if (height <= 0.45) return 'floor';
  if (height >= 2.2) return 'ceiling';
  return 'wall';
}

export function PointDetailsDialog({
  open,
  point,
  lengthUnit,
  onClose,
  onSave,
}: PointDetailsDialogProps) {
  const { t } = useI18n();
  const factor = lengthUnit === 'm' ? 1 : lengthUnit === 'cm' ? 100 : 1000;
  const [x, setX] = useState('');
  const [y, setY] = useState('');
  const [mounting, setMounting] = useState('wall');
  const [height, setHeight] = useState('');

  useEffect(() => {
    if (!open || !point) return;
    setX(String(Number(point.x.toFixed(2))));
    setY(String(Number(point.y.toFixed(2))));
    setMounting(presetFor(point.mountingHeight));
    const meters = point.mountingHeight ?? 1.1;
    setHeight(
      String(
        lengthUnit === 'm'
          ? Number(meters.toFixed(2))
          : Math.round(meters * factor),
      ),
    );
  }, [open, point, factor, lengthUnit]);

  if (!point) return null;

  const save = () => {
    const parsedX = Number(x.replace(',', '.'));
    const parsedY = Number(y.replace(',', '.'));
    const parsedHeight = Number(height.replace(',', '.'));
    onSave(point.id, {
      ...(Number.isFinite(parsedX) ? { x: parsedX } : {}),
      ...(Number.isFinite(parsedY) ? { y: parsedY } : {}),
      ...(Number.isFinite(parsedHeight) && parsedHeight >= 0
        ? { mountingHeight: parsedHeight / factor }
        : {}),
    });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${t(`editor.point.${point.type}`)} · ${t('editor.pointDetails.title')}`}
      description={t('editor.pointDetails.description')}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('editor.pointDetails.skip')}
          </Button>
          <Button onClick={save}>{t('editor.pointDetails.save')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-foreground">
            {t('editor.section.position')}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block text-xs text-muted-foreground">
              X
              <Input
                value={x}
                onChange={(event) => setX(event.target.value)}
                className="mt-1"
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Y
              <Input
                value={y}
                onChange={(event) => setY(event.target.value)}
                className="mt-1"
              />
            </label>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {t('editor.planUnits')}
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-foreground">
            {t('editor.pointDetails.mounting')}
          </p>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {MOUNT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setMounting(preset.id);
                  setHeight(
                    String(
                      lengthUnit === 'm'
                        ? preset.meters
                        : Math.round(preset.meters * factor),
                    ),
                  );
                }}
                aria-pressed={mounting === preset.id}
                className={`h-8 rounded-lg border text-xs transition ${
                  mounting === preset.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent'
                }`}
              >
                {t(`mounting.${preset.id}`)}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-xs text-muted-foreground">
            {t('editor.heightFromFloor')}
            <span className="relative mt-1 block">
              <Input
                value={height}
                onChange={(event) => setHeight(event.target.value)}
                className="pr-10"
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-muted-foreground">
                {lengthUnit}
              </span>
            </span>
          </label>
        </div>
      </div>
    </Dialog>
  );
}
