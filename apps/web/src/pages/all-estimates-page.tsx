import { Download, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-context';
import { WorkspaceHeader } from '@/features/workspace/workspace-header';
import {
  createExportLinks,
  listAllEstimates,
} from '@/features/editor/materials-api';
import type { PublicEstimate } from '@drawmyplace/contracts';
import { getErrorMessage } from '@/lib/api';

function total(estimate: PublicEstimate): number {
  return estimate.items.reduce((sum, item) => sum + (item.subtotal ?? 0), 0);
}

export function AllEstimatesPage() {
  const { formatCurrency, formatDate, t } = useI18n();
  const [estimates, setEstimates] = useState<PublicEstimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    void (async () => {
      try {
        setEstimates(await listAllEstimates());
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="relative min-h-screen">
      <WorkspaceHeader badge={t('estimates.badge')} />
      <main id="main-content" className="mx-auto max-w-5xl px-6 py-10">
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
        >
          {t('estimates.backShort')}
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
          {t('estimates.allTitle')}
        </h1>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        {loading ? (
          <div className="mt-8 flex items-center gap-3 text-sm text-slate-400">
            <LoaderCircle className="h-5 w-5 animate-spin text-amber-300" />
            {t('estimates.loadingShort')}
          </div>
        ) : estimates.length === 0 ? (
          <div className="mt-8 app-panel p-8 text-center text-sm text-slate-400">
            {t('estimates.empty')}
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {estimates.map((estimate) => (
              <li
                key={estimate.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/60 p-4"
              >
                <div>
                  <p className="font-medium text-white">
                    {t('estimates.version', {
                      version: estimate.version,
                    })}{' '}
                    <span className="text-xs font-normal text-slate-400">
                      ({t(`estimates.status.${estimate.status}`)})
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(estimate.createdAt)} ·{' '}
                    {t('estimates.linesTotal', {
                      lines: estimate.items.length,
                      total: formatCurrency(total(estimate)),
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/app/projects/${estimate.projectId}/estimates`}
                    className="text-sm text-amber-300 hover:text-amber-200"
                  >
                    {t('estimates.project')}
                  </Link>
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
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}