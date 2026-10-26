import {
  DEVICE_CATEGORY_ORDER,
  DEVICE_SUBTYPE_DEFINITIONS,
  type DeviceCategory,
  type DeviceProduct,
  type DeviceSubtype,
  type ElectricalPointType,
  type PublicPoint,
  searchDeviceProducts,
} from '@drawmyplace/contracts';
import { Check, Library, Link2, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/features/i18n/i18n-context';

interface SymbolLibraryPanelProps {
  selectedPoint?: PublicPoint | null;
  onPlace?: (
    type: ElectricalPointType,
    subtype: DeviceSubtype,
    productId: string,
  ) => void;
  onAssign?: (productId: string) => void;
  onClearProduct?: () => void;
}

type CategoryFilter = DeviceCategory | 'all';

const SYMBOL_COLORS: Record<ElectricalPointType, string> = {
  socket: '#38bdf8',
  switch: '#a78bfa',
  light: '#facc15',
  panel: '#fb7185',
  junction: '#34d399',
  custom: '#94a3b8',
};

/** Inline preview of the canvas symbol used for a device subtype. */
export function DeviceSymbol({
  type,
  size = 28,
  muted = false,
}: {
  type: ElectricalPointType;
  size?: number;
  muted?: boolean;
}) {
  const color = muted ? '#64748b' : SYMBOL_COLORS[type];
  const common = {
    fill: 'none',
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="-14 -14 28 28"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="0" cy="0" r="11" fill="#020617" stroke={color} strokeWidth="1.2" />
      {type === 'socket' ? <line x1="0" y1="-6" x2="0" y2="6" {...common} /> : null}
      {type === 'switch' ? (
        <line x1="-2" y1="2" x2="8" y2="-7" {...common} />
      ) : null}
      {type === 'light' ? (
        <>
          <line x1="-5" y1="-5" x2="5" y2="5" {...common} />
          <line x1="-5" y1="5" x2="5" y2="-5" {...common} />
        </>
      ) : null}
      {type === 'panel' ? (
        <>
          <rect x="-7" y="-6" width="14" height="12" fill={color} stroke="none" />
          <line x1="-4" y1="-2" x2="4" y2="-2" stroke="#020617" strokeWidth="1.5" />
          <line x1="-4" y1="2" x2="4" y2="2" stroke="#020617" strokeWidth="1.5" />
        </>
      ) : null}
      {type === 'junction' ? <circle cx="0" cy="0" r="3" fill={color} /> : null}
      {type === 'custom' ? (
        <polygon
          points="0,-8 8,0 0,8 -8,0"
          fill="#020617"
          stroke={color}
          strokeWidth="2"
        />
      ) : null}
    </svg>
  );
}

export function SymbolLibraryPanel({
  selectedPoint = null,
  onPlace,
  onAssign,
  onClearProduct,
}: SymbolLibraryPanelProps) {
  const { t, formatCurrency } = useI18n();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [announcement, setAnnouncement] = useState('');

  const products = useMemo(
    () =>
      searchDeviceProducts(query, {
        category: category === 'all' ? null : category,
      }),
    [query, category],
  );
  const selectedProduct = selectedPoint?.properties.productId ?? null;

  function announce(product: DeviceProduct) {
    setAnnouncement(
      t('library.placedAnnouncement', {
        name: product.name,
        article: product.article,
      }),
    );
  }

  return (
    <section className="editor-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">{t('library.title')}</h2>
        <Library className="h-4 w-4 text-amber-300" />
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        {t('library.hint')}
      </p>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('library.search')}
          aria-label={t('library.searchLabel')}
          className="h-9 pl-8 text-xs"
        />
        {query ? (
          <button
            type="button"
            aria-label={t('library.clearSearch')}
            onClick={() => setQuery('')}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-slate-500 hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {(['all', ...DEVICE_CATEGORY_ORDER] as CategoryFilter[]).map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
            className={
              category === item
                ? 'rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[10px] text-amber-100'
                : 'rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-400 transition hover:bg-white/5 hover:text-slate-200'
            }
          >
            {item === 'all' ? t('library.all') : t(`devices.category.${item}`)}
          </button>
        ))}
      </div>

      {selectedPoint ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-[11px] text-slate-400">
          <p>
            {t('library.assignHint')}
          </p>
          {selectedProduct ? (
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="truncate text-amber-200">
                {selectedProduct}
              </span>
              {onClearProduct ? (
                <button
                  type="button"
                  onClick={onClearProduct}
                  className="shrink-0 text-[10px] text-slate-500 underline-offset-2 hover:text-rose-300 hover:underline"
                >
                  {t('library.clear')}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="mt-2 text-[10px] text-slate-500">
        {t('library.results', { count: products.length })}
      </p>

      <ul className="mt-1.5 max-h-[26rem] space-y-1 overflow-y-auto pr-0.5">
        {products.map((product) => {
          const type = DEVICE_SUBTYPE_DEFINITIONS[product.subtype].type;
          const assigned = selectedProduct === product.id;

          return (
            <li
              key={product.id}
              className="rounded-lg border border-white/8 bg-white/[0.02] p-2"
            >
              <div className="flex items-start gap-2">
                <DeviceSymbol type={type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-slate-200">
                    {product.name}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">
                    {product.manufacturer} · {product.series}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">
                    {t('library.article')}: {product.article} · {product.rating}
                  </p>
                  <p className="truncate text-[10px] text-slate-500">
                    {t(`devices.subtype.${product.subtype}`)} ·{' '}
                    {t('library.standard')}: {product.standard}
                  </p>
                  {product.materialCode ? (
                    <p className="truncate text-[10px] text-slate-500">
                      {t('library.material')}: {product.materialCode}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-right text-[10px] tabular-nums text-amber-200">
                  {product.unitPrice === null
                    ? '—'
                    : formatCurrency(product.unitPrice)}
                </span>
              </div>

              <div className="mt-1.5 flex items-center justify-end gap-1.5">
                {onAssign ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    disabled={assigned}
                    onClick={() => {
                      onAssign(product.id);
                      announce(product);
                    }}
                  >
                    {assigned ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Link2 className="h-3 w-3" />
                    )}
                    {assigned ? t('library.assigned') : t('library.assign')}
                  </Button>
                ) : null}
                {onPlace ? (
                  <Button
                    size="sm"
                    className="h-7 px-2 text-[10px]"
                    onClick={() => {
                      onPlace(type, product.subtype, product.id);
                      announce(product);
                    }}
                  >
                    {t('library.place')}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {products.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">{t('library.empty')}</p>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <p className="mt-2 text-[10px] text-slate-500">{t('library.genericHint')}</p>
    </section>
  );
}
