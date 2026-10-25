import { LoaderCircle, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { WorkspaceHeader } from '@/features/workspace/workspace-header';
import {
  listAdminOrganizations,
  listAdminUsers,
} from '@/features/admin/admin-api';
import type { PublicOrganization, PublicUser } from '@drawmyplace/contracts';
import { ApiError, getErrorMessage } from '@/lib/api';

export function AdminPage() {
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [organizations, setOrganizations] = useState<PublicOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [userList, orgList] = await Promise.all([
          listAdminUsers(),
          listAdminOrganizations(),
        ]);
        setUsers(userList);
        setOrganizations(orgList);
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
        } else {
          setError(getErrorMessage(err));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="relative min-h-screen">
      <WorkspaceHeader badge="Admin" />
      <main id="main-content" className="mx-auto max-w-6xl px-6 py-10">
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
        >
          Back
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
          Platform administration
        </h1>

        {loading ? (
          <div className="mt-8 flex items-center gap-3 text-sm text-slate-400">
            <LoaderCircle className="h-5 w-5 animate-spin text-amber-300" />
            Loading…
          </div>
        ) : forbidden ? (
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-6 text-sm text-amber-100">
            <ShieldAlert className="h-5 w-5" />
            Platform administrator access required. Add your email to
            `PLATFORM_ADMIN_EMAILS` and restart the API.
          </div>
        ) : error ? (
          <p className="mt-8 text-sm text-rose-300">{error}</p>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <h2 className="text-sm font-semibold text-white">
                Users ({users.length})
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {users.map((user) => (
                  <li
                    key={user.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/5 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-slate-200">
                        {user.name}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {user.email}
                      </span>
                    </span>
                    <span className="text-xs text-slate-400">{user.status}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
              <h2 className="text-sm font-semibold text-white">
                Organizations ({organizations.length})
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {organizations.map((org) => (
                  <li
                    key={org.id}
                    className="rounded-lg border border-white/5 px-3 py-2"
                  >
                    <span className="block text-slate-200">{org.name}</span>
                    <span className="block text-xs text-slate-500">
                      owner {org.ownerId}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}