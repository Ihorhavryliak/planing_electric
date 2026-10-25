import { LoaderCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthShell } from '@/components/auth-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { requestPasswordReset } from '@/features/auth/password-reset-api';
import { getErrorMessage } from '@/lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We will email you a link that expires in one hour."
      footer={
        <>
          Remembered it?{' '}
          <Link
            to="/login"
            className="font-medium text-amber-300 hover:text-amber-200"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          If an account exists for that address, a reset link has been sent.
        </p>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-xs font-medium tracking-wide text-slate-400 uppercase">
            Email
            <Input
              className="mt-1.5"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
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
            {submitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}