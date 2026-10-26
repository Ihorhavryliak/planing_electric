import { Copy, LoaderCircle, Plus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PublicVariant } from '@drawmyplace/contracts';
import { useI18n } from '@/features/i18n/i18n-context';
import { getErrorMessage } from '@/lib/api';
import {
  createVariant,
  duplicateVariant,
  listVariants,
  updateVariant,
} from './variants-api';

export function VariantsPanel({ projectId }: { projectId: string }) {
  const { formatCurrency, formatMeters, t } = useI18n();
  const [variants, setVariants] = useState<PublicVariant[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await listVariants(projectId);
        if (!cancelled) setVariants(loaded);
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await createVariant(projectId, name);
      setVariants((current) => [...current, created]);
      setName('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(variant: PublicVariant) {
    const next = window.prompt(t('variants.namePlaceholder'), variant.name);
    if (!next || next.trim() === variant.name) return;
    try {
      const updated = await updateVariant(variant.id, { name: next.trim() });
      setVariants((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleStatus(variant: PublicVariant) {
    try {
      const updated = await updateVariant(variant.id, {
        status: variant.status === 'active' ? 'archived' : 'active',
      });
      setVariants((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleDuplicate(variant: PublicVariant) {
    try {
      const created = await duplicateVariant(variant.id);
      setVariants((current) => [...current, created]);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <section className="mt-6 app-panel p-5">
      <h2 className="text-sm font-semibold text-white">
        {t('variants.title')}
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        {t('variants.subtitle')}
      </p>
      <form className="mt-4 flex flex-wrap gap-2" onSubmit={handleCreate}>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('variants.namePlaceholder')}
          required
          className="min-w-56 flex-1"
        />
        <Button type="submit" disabled={busy}>
          <Plus className="h-4 w-4" />
          {t('variants.save')}
        </Button>
      </form>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-300">
          {error}
        </p>
      ) : null}
      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
          <LoaderCircle className="h-4 w-4 animate-spin text-amber-300" />
          {t('variants.loading')}
        </div>
      ) : variants.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">{t('variants.empty')}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="py-2">{t('variants.name')}</th>
                <th className="py-2">{t('variants.status')}</th>
                <th className="py-2">{t('variants.routes')}</th>
                <th className="py-2">{t('variants.points')}</th>
                <th className="py-2">{t('variants.cable')}</th>
                <th className="py-2">{t('variants.cost')}</th>
                <th className="py-2">{t('variants.warnings')}</th>
                <th className="py-2">{t('variants.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((variant) => (
                <tr key={variant.id} className="border-t border-white/5">
                  <td className="py-2 pr-3 text-slate-200">{variant.name}</td>
                  <td className="py-2 pr-3 text-slate-400">
                    {t(`variants.status.${variant.status}`)}
                  </td>
                  <td className="py-2 pr-3 text-slate-300">
                    {variant.metrics.routeCount}
                  </td>
                  <td className="py-2 pr-3 text-slate-300">
                    {variant.metrics.pointCount}
                  </td>
                  <td className="py-2 pr-3 text-slate-300">
                    {variant.metrics.totalRequiredLength === null
                      ? '—'
                      : formatMeters(variant.metrics.totalRequiredLength)}
                  </td>
                  <td className="py-2 pr-3 text-slate-300">
                    {variant.metrics.estimatedCost === null
                      ? '—'
                      : formatCurrency(variant.metrics.estimatedCost)}
                  </td>
                  <td className="py-2 pr-3 text-amber-200">
                    {variant.metrics.warningCount}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleRename(variant)}
                      >
                        {t('variants.rename')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleDuplicate(variant)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleStatus(variant)}
                      >
                        {variant.status === 'active'
                          ? t('variants.archive')
                          : t('variants.restore')}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}