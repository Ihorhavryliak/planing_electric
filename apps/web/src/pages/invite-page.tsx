import { LoaderCircle, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-context';
import { WorkspaceHeader } from '@/features/workspace/workspace-header';
import { acceptInvitation } from '@/features/organizations/organizations-api';
import { getErrorMessage } from '@/lib/api';

export function InvitePage() {
  const { t } = useI18n();
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
        setError(t('invite.invalid'));
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
      <WorkspaceHeader badge={t('invite.badge')} />
      <main id="main-content" className="page-shell">
        <div className="max-w-md app-panel p-6">
          <MailCheck className="h-8 w-8 text-amber-300" />
          <h1 className="mt-4 text-2xl font-semibold text-white">
            {t('invite.title')}
          </h1>
          {accepted ? (
            <>
              <p className="mt-2 text-sm text-emerald-200">
                {t('invite.accepted')}
              </p>
              <Link
                to="/app/organizations"
                className="mt-5 inline-flex text-sm text-amber-300 hover:text-amber-200"
              >
                {t('invite.openOrgs')}
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-400">
                {t('invite.intro')}
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
                {busy ? t('invite.accepting') : t('invite.accept')}
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}