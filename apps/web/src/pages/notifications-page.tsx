import { ArrowLeft, Bell, CheckCheck, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { WorkspaceHeader } from '@/features/workspace/workspace-header';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationEntry,
} from '@/features/notifications/notifications-api';
import { getErrorMessage } from '@/lib/api';

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await listNotifications());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  async function handleRead(id: string) {
    setBusy(true);
    try {
      const updated = await markNotificationRead(id);
      if (updated) {
        setItems((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleReadAll() {
    setBusy(true);
    try {
      await markAllNotificationsRead();
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <WorkspaceHeader badge="Notifications" />
      <main id="main-content" className="mx-auto max-w-3xl px-6 py-10">
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <div className="mt-4 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Notifications
          </h1>
          <Button variant="outline" onClick={handleReadAll} disabled={busy}>
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </Button>
        </div>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
        {loading ? (
          <div className="mt-8 flex items-center gap-3 text-sm text-slate-400">
            <LoaderCircle className="h-5 w-5 animate-spin text-amber-300" />
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
            <Bell className="mx-auto mb-3 h-6 w-6 text-slate-500" />
            No notifications yet.
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className={`rounded-xl border p-4 ${
                  item.readAt
                    ? 'border-white/10 bg-slate-900/40'
                    : 'border-amber-400/20 bg-amber-400/5'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-white">{item.type}</span>
                  <span className="text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>
                {!item.readAt ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    disabled={busy}
                    onClick={() => handleRead(item.id)}
                  >
                    Mark read
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}