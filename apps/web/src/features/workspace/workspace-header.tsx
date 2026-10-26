import {
  Bell,
  Building2,
  Globe2,
  LoaderCircle,
  LogOut,
  Monitor,
  Moon,
  Package,
  Sun,
  Zap,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { useLogout } from '@/features/auth/use-logout';
import { listNotifications } from '@/features/notifications/notifications-api';
import { useI18n } from '@/features/i18n/i18n-context';
import { LOCALES, type Locale } from '@/features/i18n/i18n';
import { useTheme } from '@/features/theme/theme-context';
import { apiRequest, getErrorMessage } from '@/lib/api';

interface WorkspaceHeaderProps {
  badge?: string;
  children?: ReactNode;
}

export function WorkspaceHeader({
  badge = 'Phase 2 · Projects',
  children,
}: WorkspaceHeaderProps) {
  const { user } = useAuth();
  const { preference, resolved, toggle } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const { loggingOut, logoutError, signOut } = useLogout();
  const themeLabel =
    preference === 'system'
      ? `${t('nav.themeSystem')} (${resolved})`
      : preference === 'light'
        ? t('nav.themeLight')
        : t('nav.themeDark');
  const [unread, setUnread] = useState(0);
  const [verificationMessage, setVerificationMessage] = useState<
    string | null
  >(null);
  const [resending, setResending] = useState(false);

  async function resendVerification() {
    setResending(true);
    setVerificationMessage(null);
    try {
      await apiRequest<void>('/auth/resend-verification', { method: 'POST' });
      setVerificationMessage('Verification email sent.');
    } catch (error) {
      setVerificationMessage(getErrorMessage(error));
    } finally {
      setResending(false);
    }
  }

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const items = await listNotifications();
        if (!cancelled) {
          setUnread(items.filter((item) => !item.readAt).length);
        }
      } catch {
        if (!cancelled) setUnread(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Link to="/app" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20">
            <Zap className="h-4 w-4" fill="currentColor" />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-wide text-white">
              DrawMyPlace
            </span>
            <span className="block text-xs text-slate-400">
              {t('nav.workspace')}
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {children}
          <label
            className="inline-flex items-center gap-1 text-slate-300"
            title={t('nav.language')}
          >
            <Globe2 className="h-4 w-4" />
            <select
              aria-label={t('nav.language')}
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
              className="h-8 rounded-lg border border-white/10 bg-slate-900 px-2 text-xs text-slate-200"
            >
              {LOCALES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={toggle}
            title={themeLabel}
            aria-label={themeLabel}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            {preference === 'system' ? (
              <Monitor className="h-4 w-4" />
            ) : resolved === 'dark' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>
          <Link
            to="/app/organizations"
            aria-label={t('nav.organizations')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Building2 className="h-4 w-4" />
          </Link>
          <Link
            to="/app/materials"
            aria-label={t('nav.materials')}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Package className="h-4 w-4" />
          </Link>
          <Link
            to="/app/notifications"
            aria-label={
              unread > 0
                ? `${t('nav.notifications')} (${unread})`
                : t('nav.notifications')
            }
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 ? (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-slate-950">
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </Link>
          {user ? (
            <Link
              to="/app/settings"
              className="hidden max-w-48 truncate text-sm text-slate-300 hover:text-white sm:block"
            >
              {user.name}
            </Link>
          ) : null}
          <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-200 md:block">
            {badge}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={signOut}
            disabled={loggingOut}
          >
            {loggingOut ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            {loggingOut ? t('nav.signingOut') : t('nav.signOut')}
          </Button>
        </div>
      </div>

      {user && !user.emailVerified ? (
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-6 pb-3 text-xs text-amber-100">
          <span className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2">
            {t('nav.verifyEmail')}
            {verificationMessage ? ` ${verificationMessage}` : ''}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void resendVerification()}
            disabled={resending}
          >
            {resending ? t('nav.sending') : t('nav.resendEmail')}
          </Button>
        </div>
      ) : null}

      {logoutError ? (
        <div className="mx-auto max-w-6xl px-6 pb-3">
          <p
            role="alert"
            className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100"
          >
            {logoutError}
          </p>
        </div>
      ) : null}
    </header>
  );
}
