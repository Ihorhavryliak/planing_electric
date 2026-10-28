import { LoaderCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resetPassword } from '@/features/auth/password-reset-api';
import { useI18n } from '@/features/i18n/i18n-context';
import { getErrorMessage } from '@/lib/api';

export function ResetPasswordPage() {
  const { t } = useI18n();
  const { token = '' } = useParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) {
      setError(t('auth.reset.mismatch'));
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
      title={t('auth.reset.title')}
      subtitle={t('auth.reset.subtitle')}
      footer={
        <Link
          to="/login"
          className="font-medium text-primary hover:text-primary/80"
        >
          {t('auth.forgot.back')}
        </Link>
      }
    >
      {done ? (
        <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {t('auth.reset.done')}
        </p>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-xs font-medium tracking-wide text-slate-400 uppercase">
            {t('auth.reset.newPassword')}
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
            {t('auth.reset.confirmPassword')}
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
            {submitting ? t('auth.reset.saving') : t('auth.reset.submit')}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}