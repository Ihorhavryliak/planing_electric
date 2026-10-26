import { LoaderCircle, Save } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/auth-context';
import { WorkspaceHeader } from '@/features/workspace/workspace-header';
import { apiRequest, getErrorMessage } from '@/lib/api';

export function SettingsPage() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);

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
      </main>
    </div>
  );
}