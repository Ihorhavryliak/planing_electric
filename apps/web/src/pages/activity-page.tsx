import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useI18n } from '@/features/i18n/i18n-context';
import { WorkspaceHeader } from '@/features/workspace/workspace-header';
import { listActivity, type ActivityLogEntry } from '@/features/activity/activity-api';
import { getErrorMessage } from '@/lib/api';

export function ActivityPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { formatDate } = useI18n();
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        setEntries(await listActivity(projectId));
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  return (
    <div className="relative min-h-screen">
      <WorkspaceHeader badge="Activity" />
      <main id="main-content" className="mx-auto max-w-4xl px-6 py-10">
        <Link
          to={`/app/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to project
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
          Activity
        </h1>
        {error ? (
          <p className="mt-4 text-sm text-rose-300">{error}</p>
        ) : null}
        {loading ? (
          <div className="mt-8 flex items-center gap-3 text-sm text-slate-400">
            <LoaderCircle className="h-5 w-5 animate-spin text-amber-300" />
            Loading…
          </div>
        ) : entries.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
            No activity yet.
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl border border-white/10 bg-slate-900/60 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-white">{entry.action}</span>
                  <span className="text-xs text-slate-500">
                    {formatDate(entry.createdAt)}
                  </span>
                </div>
                {entry.resourceType ? (
                  <p className="mt-1 text-xs text-slate-400">
                    {entry.resourceType} {entry.resourceId ?? ''}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}