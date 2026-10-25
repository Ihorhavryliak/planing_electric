import { LoaderCircle, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { WorkspaceHeader } from '@/features/workspace/workspace-header';
import { acceptInvitation } from '@/features/organizations/organizations-api';
import { getErrorMessage } from '@/lib/api';

export function InvitePage() {
  const { token = '' } = useParams<{ token: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  async function handleAccept() {
    setBusy(true);
    setError(null);
    try {
      const result = await acceptInvitation(token);
      if (!result) {
        setError('This invitation is invalid, expired, or already used.');
        return;
      }
      setAccepted(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <WorkspaceHeader badge="Invitation" />
      <main id="main-content" className="mx-auto max-w-xl px-6 py-16">
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
          <MailCheck className="h-8 w-8 text-amber-300" />
          <h1 className="mt-4 text-2xl font-semibold text-white">
            Organization invitation
          </h1>
          {accepted ? (
            <>
              <p className="mt-2 text-sm text-emerald-200">
                Invitation accepted. You now have access to the organization.
              </p>
              <Link
                to="/app/organizations"
                className="mt-5 inline-flex text-sm text-amber-300 hover:text-amber-200"
              >
                Open organizations
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-400">
                Accept this invitation to join the organization and collaborate
                on its projects.
              </p>
              {error ? (
                <p role="alert" className="mt-4 text-sm text-rose-300">
                  {error}
                </p>
              ) : null}
              <Button className="mt-5" onClick={handleAccept} disabled={busy}>
                {busy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : null}
                {busy ? 'Accepting…' : 'Accept invitation'}
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}