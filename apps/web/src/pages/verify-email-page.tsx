import { LoaderCircle, MailCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthShell } from '@/components/auth-shell';
import { apiRequest, getErrorMessage } from '@/lib/api';

export function VerifyEmailPage() {
  const { token = '' } = useParams<{ token: string }>();
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        await apiRequest<void>('/auth/verify-email', {
          method: 'POST',
          body: JSON.stringify({ token }),
        });
        setState('done');
      } catch (err) {
        setError(getErrorMessage(err));
        setState('error');
      }
    })();
  }, [token]);

  return (
    <AuthShell
      title="Email verification"
      subtitle="Confirm the address used for your DrawMyPlace account."
      footer={
        <Link
          to="/app"
          className="font-medium text-amber-300 hover:text-amber-200"
        >
          Continue to workspace
        </Link>
      }
    >
      {state === 'loading' ? (
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <LoaderCircle className="h-5 w-5 animate-spin text-amber-300" />
          Verifying…
        </div>
      ) : state === 'done' ? (
        <p className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          <MailCheck className="h-5 w-5" />
          Email verified. Thank you.
        </p>
      ) : (
        <p role="alert" className="text-sm text-rose-300">
          {error}
        </p>
      )}
    </AuthShell>
  );
}