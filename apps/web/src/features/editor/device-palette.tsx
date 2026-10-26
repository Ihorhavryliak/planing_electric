import {
  DEVICE_CATEGORY_ORDER,
  deviceSubtypesForCategory,
  type DeviceCategory,
  type DeviceSubtype,
  type ElectricalPointType,
} from '@drawmyplace/contracts';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-context';

interface DevicePaletteProps {
  onSelect: (type: ElectricalPointType, subtype: DeviceSubtype) => void;
}

const INITIAL_OPEN: Partial<Record<DeviceCategory, boolean>> = {
  distribution: true,
};

export function DevicePalette({ onSelect }: DevicePaletteProps) {
  const { t } = useI18n();

  return (
    <section className="editor-panel p-4">
      <h2 className="text-sm font-semibold text-white">
        {t('devices.palette')}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        {t('devices.paletteHint')}
      </p>

      <div className="mt-3 space-y-1">
        {DEVICE_CATEGORY_ORDER.map((category) => {
          const items = deviceSubtypesForCategory(category);

          return (
            <details
              key={category}
              open={INITIAL_OPEN[category]}
              className="group rounded-lg border border-white/10 bg-white/[0.02]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between px-2.5 py-2 text-xs font-medium text-slate-300 [&::-webkit-details-marker]:hidden">
                <span>{t(`devices.category.${category}`)}</span>
                <span className="flex items-center gap-2 text-[11px] text-slate-500">
                  {items.length}
                  <span className="transition-transform group-open:rotate-90">
                    ›
                  </span>
                </span>
              </summary>
              <div className="grid gap-1 border-t border-white/5 p-1.5">
                {items.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto min-h-7 justify-start px-2 py-1 text-left text-[11px] font-normal text-slate-300 hover:bg-white/10 hover:text-white"
                    onClick={() => onSelect(item.type, item.id)}
                  >
                    {t(`devices.subtype.${item.id}`)}
                  </Button>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
