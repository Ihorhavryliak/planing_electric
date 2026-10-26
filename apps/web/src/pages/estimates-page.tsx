import {
  ArrowLeft,
  Download,
  LoaderCircle,
  TriangleAlert,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/features/i18n/i18n-context';
import { WorkspaceHeader } from '@/features/workspace/workspace-header';
import {
  createExportLinks,
  listEstimatesByProject,
  updateEstimateItem,
  updateEstimateStatus,
} from '@/features/editor/materials-api';
import type { PublicEstimate, PublicEstimateItem } from '@drawmyplace/contracts';
import { getErrorMessage } from '@/lib/api';

export function EstimatesPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { formatDate } = useI18n();
  const [estimates, setEstimates] = useState<PublicEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listEstimatesByProject(projectId);
      setEstimates(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [projectId]);

  async function handleDownload(
    estimate: PublicEstimate,
    format: 'csv' | 'pdf',
  ) {
    try {
      const links = await createExportLinks(estimate.id);
      window.location.href = `/api/v1${format === 'csv' ? links.csvUrl : links.pdfUrl}`;
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleStatus(
    estimate: PublicEstimate,
    status: 'draft' | 'final',
  ) {
    setSavingItemId(estimate.id);
    try {
      const updated = await updateEstimateStatus(estimate.id, status);
      setEstimates((prev) =>
        prev.map((est) => (est.id === updated.id ? updated : est)),
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingItemId(null);
    }
  }

  async function handleOverride(
    event: FormEvent<HTMLFormElement>,
    item: PublicEstimateItem,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const quantityInput = form.elements.namedItem('quantity') as HTMLInputElement;
    const priceInput = form.elements.namedItem('unitPrice') as HTMLInputElement;
    const quantity = Number(quantityInput.value);
    const unitPrice = priceInput.value === '' ? null : Number(priceInput.value);
    setSavingItemId(item.id);
    try {
      const updated = await updateEstimateItem(item.id, {
        quantity: Number.isFinite(quantity) ? quantity : item.quantity,
        unitPrice,
        isOverridden: true,
      });
      setEstimates((prev) =>
        prev.map((est) => (est.id === updated.id ? updated : est)),
      );
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingItemId(null);
    }
  }

  if (loading) {
    return (
      <div className="relative min-h-screen">
        <WorkspaceHeader badge="Estimates" />
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-16 text-sm text-slate-400">
          <LoaderCircle className="h-5 w-5 animate-spin text-amber-300" />
          Loading estimates…
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <WorkspaceHeader badge="Estimates" />
      <main id="main-content" className="mx-auto max-w-6xl px-6 py-10">
        <Link
          to={`/app/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to project
        </Link>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
          Estimates
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Material takeoff versions generated from plan calculations.
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
          >
            {error}
          </p>
        ) : null}

        {estimates.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
            No estimates yet. Generate one from the plan editor.
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {estimates.map((estimate) => (
              <section
                key={estimate.id}
                className="rounded-2xl border border-white/10 bg-slate-900/60 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Version {estimate.version}{' '}
                      <span className="text-sm font-normal text-slate-400">
                        ({estimate.status})
                      </span>
                    </h2>
                    <p className="text-xs text-slate-500">
                      {formatDate(estimate.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={savingItemId === estimate.id}
                      onClick={() =>
                        handleStatus(
                          estimate,
                          estimate.status === 'final' ? 'draft' : 'final',
                        )
                      }
                    >
                      {estimate.status === 'final'
                        ? 'Mark draft'
                        : 'Mark final'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleDownload(estimate, 'csv')}
                    >
                      <Download className="h-4 w-4" />
                      CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleDownload(estimate, 'pdf')}
                    >
                      <Download className="h-4 w-4" />
                      PDF
                    </Button>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500">
                        <th className="py-2">Description</th>
                        <th className="py-2">Unit</th>
                        <th className="py-2">Qty</th>
                        <th className="py-2">Purchase</th>
                        <th className="py-2">Price</th>
                        <th className="py-2">Subtotal</th>
                        <th className="py-2">Override</th>
                      </tr>
                    </thead>
                    <tbody>
                      {estimate.items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-t border-white/5"
                        >
                          <td className="py-2 pr-3 text-slate-200">
                            {item.description}
                            {item.isOverridden ? (
                              <span className="ml-2 text-xs text-amber-300">
                                (overridden)
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2 pr-3 text-slate-400">
                            {item.unit}
                          </td>
                          <td className="py-2 pr-3 text-slate-200">
                            {item.quantity}
                          </td>
                          <td className="py-2 pr-3 text-slate-200">
                            {item.purchaseQuantity ?? '—'}
                          </td>
                          <td className="py-2 pr-3 text-slate-200">
                            {item.unitPrice ?? '—'}
                          </td>
                          <td className="py-2 pr-3 text-slate-200">
                            {item.subtotal ?? '—'}
                          </td>
                          <td className="py-2">
                            <form
                              className="flex items-center gap-2"
                              onSubmit={(e) => handleOverride(e, item)}
                            >
                              <Input
                                name="quantity"
                                type="number"
                                step="0.001"
                                defaultValue={item.quantity}
                                className="h-8 w-20"
                              />
                              <Input
                                name="unitPrice"
                                type="number"
                                step="0.01"
                                defaultValue={item.unitPrice ?? ''}
                                className="h-8 w-20"
                              />
                              <Button
                                type="submit"
                                size="sm"
                                disabled={savingItemId === item.id}
                              >
                                {savingItemId === item.id ? (
                                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  'Save'
                                )}
                              </Button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {estimate.items.some((i) => i.isOverridden) ? (
                  <p className="mt-3 text-xs text-amber-300">
                    <TriangleAlert className="mr-1 inline h-3.5 w-3.5" />
                    Some items have manual overrides.
                  </p>
                ) : null}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}