import { LoaderCircle, Save } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { useTheme } from '@/features/theme/theme-context';
import { WorkspaceHeader } from '@/features/workspace/workspace-header';
import { apiRequest, getErrorMessage } from '@/lib/api';

export function SettingsPage() {
  const { user, refresh } = useAuth();
  const { preference, setPreference } = useTheme();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

  interface SessionEntry {
    id: string;
    current: boolean;
    userAgent: string | null;
    ipAddress: string | null;
    createdAt: string;
    lastUsedAt: string | null;
  }
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setSessions(await apiRequest<SessionEntry[]>('/auth/sessions'));
      } catch {
        setSessions([]);
      }
    })();
  }, []);

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !window.confirm(
        'Delete your account and all projects? This cannot be undone.',
      )
    ) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiRequest<void>('/users/me', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
      });
      window.location.href = '/login';
    } catch (err) {
      setDeleteError(getErrorMessage(err));
      setDeleting(false);
    }
  }

  async function revokeSession(id: string) {
    try {
      await apiRequest<void>(`/auth/sessions/${id}`, { method: 'DELETE' });
      setSessions((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChangingPassword(true);
    setPasswordError(null);
    setPasswordSaved(false);
    try {
      await apiRequest<void>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordSaved(true);
    } catch (err) {
      setPasswordError(getErrorMessage(err));
    } finally {
      setChangingPassword(false);
    }
  }

  useEffect(() => {
    setName(user?.name ?? '');
  }, [user?.name]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch('/api/v1/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <WorkspaceHeader badge="Settings" />
      <main id="main-content" className="mx-auto max-w-2xl px-6 py-10">
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
        >
          Back
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">
          Settings
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Update your profile. Email changes are not available yet.
        </p>

        <form
          className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-5"
          onSubmit={handleSubmit}
        >
          <label className="block text-xs font-medium tracking-wide text-slate-400 uppercase">
            Name
            <Input
              className="mt-1.5"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={100}
            />
          </label>
          <label className="block text-xs font-medium tracking-wide text-slate-400 uppercase">
            Email
            <Input className="mt-1.5" value={user?.email ?? ''} disabled />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-rose-300">
              {error}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            {saved ? (
              <span className="text-xs text-emerald-300">Saved</span>
            ) : null}
          </div>
        </form>

        <section className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-white">Appearance</h2>
          <p className="mt-1 text-xs text-slate-500">
            Follow the system setting or choose a theme explicitly.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(['system', 'light', 'dark'] as const).map((option) => (
              <Button
                key={option}
                variant={preference === option ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPreference(option)}
              >
                {option === 'system'
                  ? 'System'
                  : option === 'light'
                    ? 'Light'
                    : 'Dark'}
              </Button>
            ))}
          </div>
        </section>

        <form
          className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-slate-900/60 p-5"
          onSubmit={handlePasswordChange}
        >
          <h2 className="text-sm font-semibold text-white">Change password</h2>
          <label className="block text-xs font-medium tracking-wide text-slate-400 uppercase">
            Current password
            <Input
              className="mt-1.5"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <label className="block text-xs font-medium tracking-wide text-slate-400 uppercase">
            New password
            <Input
              className="mt-1.5"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              minLength={10}
              autoComplete="new-password"
            />
          </label>
          {passwordError ? (
            <p role="alert" className="text-sm text-rose-300">
              {passwordError}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={changingPassword}>
              {changingPassword ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {changingPassword ? 'Saving…' : 'Update password'}
            </Button>
            {passwordSaved ? (
              <span className="text-xs text-emerald-300">Password updated</span>
            ) : null}
          </div>
        </form>

        <section className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-white">Active sessions</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="block truncate text-slate-200">
                    {session.userAgent ?? 'Unknown browser'}
                    {session.current ? ' (this session)' : ''}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {session.ipAddress ?? 'unknown ip'} ·{' '}
                    {new Date(session.createdAt).toLocaleString()}
                  </span>
                </span>
                {!session.current ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void revokeSession(session.id)}
                  >
                    Revoke
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-slate-900/60 p-5">
          <h2 className="text-sm font-semibold text-white">Your data</h2>
          <p className="mt-1 text-xs text-slate-500">
            Download a JSON copy of your profile, projects, drawings, and
            estimates.
          </p>
          <a
            href="/api/v1/users/me/export"
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-slate-200 hover:bg-white/10"
          >
            Download account data
          </a>
        </section>

        <section className="mt-6 rounded-2xl border border-rose-400/20 bg-rose-400/5 p-5">
          <h2 className="text-sm font-semibold text-rose-200">Danger zone</h2>
          <p className="mt-1 text-xs text-rose-200/70">
            Deleting your account removes all projects, drawings, and estimates.
          </p>
          <form className="mt-4 flex flex-wrap gap-2" onSubmit={handleDeleteAccount}>
            <Input
              type="password"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              placeholder="Confirm with your password"
              required
              className="min-w-56 flex-1"
            />
            <Button type="submit" variant="outline" disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete account'}
            </Button>
          </form>
          {deleteError ? (
            <p role="alert" className="mt-2 text-sm text-rose-300">
              {deleteError}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}