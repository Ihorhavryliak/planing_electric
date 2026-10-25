import { LoaderCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resetPassword } from '@/features/auth/password-reset-api';
import { getErrorMessage } from '@/lib/api';

export function ResetPasswordPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="This link works once and expires after one hour."
      footer={
        <Link
          to="/login"
          className="font-medium text-amber-300 hover:text-amber-200"
        >
          Back to sign in
        </Link>
      }
    >
      {done ? (
        <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          Password updated. You can now sign in with the new password.
        </p>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-xs font-medium tracking-wide text-slate-400 uppercase">
            New password
            <Input
              className="mt-1.5"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={10}
              autoComplete="new-password"
            />
          </label>
          <label className="block text-xs font-medium tracking-wide text-slate-400 uppercase">
            Confirm password
            <Input
              className="mt-1.5"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
              autoComplete="new-password"
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-rose-300">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : null}
            {submitting ? 'Saving…' : 'Set new password'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}