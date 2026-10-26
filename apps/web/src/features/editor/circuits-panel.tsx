import type {
  Circuit,
  PublicPoint,
  PublicRoute,
} from '@drawmyplace/contracts';
import { Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/features/i18n/i18n-context';

interface CircuitsPanelProps {
  circuits: readonly Circuit[];
  points: readonly PublicPoint[];
  routes: readonly PublicRoute[];
  onAdd: (circuit: Circuit) => void;
  onUpdate: (
    id: string,
    patch: Partial<Pick<Circuit, 'name' | 'color'>>,
  ) => void;
  onDelete: (id: string) => void;
}

function CircuitRow({
  circuit,
  pointCount,
  routeCount,
  onUpdate,
  onDelete,
}: {
  circuit: Circuit;
  pointCount: number;
  routeCount: number;
  onUpdate: (id: string, patch: Partial<Pick<Circuit, 'name' | 'color'>>) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(circuit.name);
  const assigned = pointCount + routeCount > 0;

  return (
    <li className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: circuit.color }}
        />
        <span className="font-mono text-xs font-semibold text-amber-200">
          {circuit.id}
        </span>
        <Input
          value={name}
          aria-label={t('circuits.name')}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            const next = name.trim();
            if (next && next !== circuit.name) onUpdate(circuit.id, { name: next });
            else setName(circuit.name);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          className="h-7 min-w-0 flex-1 text-xs"
        />
        <input
          type="color"
          value={circuit.color}
          aria-label={t('circuits.color')}
          onChange={(event) =>
            onUpdate(circuit.id, { color: event.target.value })
          }
          className="h-7 w-8 cursor-pointer rounded border border-white/10 bg-transparent p-0.5"
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('circuits.delete')}
          title={assigned ? t('circuits.deleteBlocked') : t('circuits.delete')}
          disabled={assigned}
          onClick={() => onDelete(circuit.id)}
          className="h-7 w-7 text-slate-400 hover:text-rose-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="mt-1 pl-4.5 text-[11px] text-slate-500">
        {t('circuits.counts', { points: pointCount, routes: routeCount })}
      </p>
    </li>
  );
}

export function CircuitsPanel({
  circuits,
  points,
  routes,
  onAdd,
  onUpdate,
  onDelete,
}: CircuitsPanelProps) {
  const { t } = useI18n();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#f59e0b');
  const [error, setError] = useState<string | null>(null);

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const id = code.trim();
    const label = name.trim();

    if (!id || !label) {
      setError(t('circuits.invalid'));
      return;
    }

    if (circuits.some((circuit) => circuit.id === id)) {
      setError(t('circuits.duplicateCode'));
      return;
    }

    onAdd({ id, name: label, color });
    setCode('');
    setName('');
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-white">
          {t('circuits.title')}
        </h2>
        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400 tabular-nums">
          {circuits.length}
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        {t('circuits.hint')}
      </p>

      {circuits.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">{t('circuits.empty')}</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {circuits.map((circuit) => (
            <CircuitRow
              key={circuit.id}
              circuit={circuit}
              pointCount={
                points.filter(
                  (point) => point.properties.circuitId === circuit.id,
                ).length
              }
              routeCount={
                routes.filter((route) => route.circuitId === circuit.id).length
              }
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}

      <form className="mt-3 space-y-2" onSubmit={handleAdd}>
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_2.25rem] gap-2">
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={t('circuits.codePlaceholder')}
            aria-label={t('circuits.code')}
            maxLength={40}
            className="h-8"
          />
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('circuits.namePlaceholder')}
            aria-label={t('circuits.name')}
            maxLength={80}
            className="h-8"
          />
          <input
            type="color"
            value={color}
            onChange={(event) => setColor(event.target.value)}
            aria-label={t('circuits.color')}
            className="h-8 w-9 cursor-pointer rounded border border-white/10 bg-transparent p-0.5"
          />
        </div>
        {error ? (
          <p role="alert" className="text-xs text-rose-300">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="outline" size="sm" className="w-full">
          <Plus className="h-4 w-4" />
          {t('circuits.add')}
        </Button>
      </form>
    </section>
  );
}
