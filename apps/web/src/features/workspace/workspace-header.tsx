import {
  Bell,
  Building2,
  FolderOpen,
  Globe2,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Monitor,
  Moon,
  Package,
  ReceiptText,
  Search,
  Settings,
  Sun,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useAuth } from '@/features/auth/auth-context';
import { useLogout } from '@/features/auth/use-logout';
import {
  CommandPalette,
  type CommandPaletteItem,
} from '@/features/editor/command-palette';
import { listNotifications } from '@/features/notifications/notifications-api';
import { useI18n } from '@/features/i18n/i18n-context';
import { LOCALES, type Locale } from '@/features/i18n/i18n';
import { useTheme } from '@/features/theme/theme-context';
import { apiRequest, getErrorMessage } from '@/lib/api';

interface WorkspaceHeaderProps {
  badge?: string;
  children?: ReactNode;
}

const BREADCRUMB_LABELS: Record<string, string> = {
  app: 'nav.workspace',
  projects: 'nav.projects',
  editor: 'breadcrumb.editor',
  documentation: 'breadcrumb.documentation',
  estimates: 'nav.estimates',
  materials: 'nav.materials',
  organizations: 'nav.organizations',
  team: 'nav.team',
  notifications: 'nav.notifications',
  settings: 'nav.settings',
  activity: 'breadcrumb.activity',
  admin: 'breadcrumb.admin',
  local: 'local.badge',
  design: 'breadcrumb.design',
  pricing: 'nav.pricing',
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function WorkspaceHeader({
  badge = 'Phase 2 · Projects',
  children,
}: WorkspaceHeaderProps) {
  const { user } = useAuth();
  const { preference, resolved, toggle } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const { loggingOut, logoutError, signOut } = useLogout();
  const navigate = useNavigate();
  const location = useLocation();
  const themeLabel =
    preference === 'system'
      ? `${t('nav.themeSystem')} (${resolved})`
      : preference === 'light'
        ? t('nav.themeLight')
        : t('nav.themeDark');
  const [unread, setUnread] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const railRoutes = new Set([
    '/app',
    '/local',
    '/app/materials',
    '/app/estimates',
    '/app/notifications',
    '/app/settings',
    '/app/organizations',
    '/app/team',
  ]);
  const showRail = railRoutes.has(location.pathname);
  const [verificationMessage, setVerificationMessage] = useState<
    string | null
  >(null);
  const [resending, setResending] = useState(false);

  const commands = useMemo<CommandPaletteItem[]>(() => {
    const items: CommandPaletteItem[] = [
      {
        id: 'projects',
        label: t('nav.projects'),
        hint: t('breadcrumb.projectsHint'),
        icon: 'dashboard',
        group: t('palette.group.navigate'),
        shortcut: 'G P',
        run: () => navigate('/app'),
      },
      {
        id: 'local',
        label: t('local.badge'),
        hint: t('breadcrumb.localHint'),
        icon: 'local',
        group: t('palette.group.navigate'),
        shortcut: 'G L',
        run: () => navigate('/local'),
      },
      {
        id: 'materials',
        label: t('nav.materials'),
        hint: t('breadcrumb.materialsHint'),
        icon: 'materials',
        group: t('palette.group.navigate'),
        shortcut: 'G M',
        run: () => navigate('/app/materials'),
      },
      {
        id: 'estimates',
        label: t('nav.estimates'),
        hint: t('breadcrumb.estimatesHint'),
        icon: 'estimates',
        group: t('palette.group.navigate'),
        run: () => navigate('/app/estimates'),
      },
      {
        id: 'notifications',
        label: t('nav.notifications'),
        icon: 'notifications',
        group: t('palette.group.navigate'),
        run: () => navigate('/app/notifications'),
      },
      {
        id: 'settings',
        label: t('nav.settings'),
        icon: 'settings',
        group: t('palette.group.navigate'),
        run: () => navigate('/app/settings'),
      },
    ];

    if (user) {
      items.push({
        id: 'theme',
        label: themeLabel,
        hint: t('breadcrumb.toggleThemeHint'),
        icon: 'theme',
        group: t('palette.group.preferences'),
        run: toggle,
      });
    }

    return items;
  }, [navigate, t, themeLabel, toggle, user]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const breadcrumbs = useMemo(() => {
    if (
      location.pathname === '/' ||
      location.pathname.startsWith('/login') ||
      location.pathname.startsWith('/register') ||
      location.pathname.startsWith('/pricing')
    ) {
      return [];
    }

    const segments = location.pathname.split('/').filter(Boolean);
    const items: Array<{ label: string; to: string }> = [];
    let path = '';

    for (const segment of segments) {
      path += `/${segment}`;
      const key = BREADCRUMB_LABELS[segment];
      const label = key
        ? t(key)
        : isUuid(segment)
          ? t('breadcrumb.item')
          : segment;
      items.push({ label, to: path });
    }

    return items;
  }, [location.pathname, t]);

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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-900/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link to="/app" className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--dmp-color-brand)] text-white shadow-lg shadow-black/10">
              <Zap className="h-3.5 w-3.5" fill="currentColor" />
            </span>
            <span className="text-sm font-semibold tracking-wide text-white">
              DrawMyPlace
            </span>
          </Link>
          <nav
            aria-label={t('breadcrumb.label')}
            className="hidden min-w-0 items-center gap-1.5 text-[11px] text-slate-500 md:flex"
          >
            {breadcrumbs.map((item, index) => (
              <span key={item.to} className="flex items-center gap-1.5">
                {index > 0 ? <span className="text-slate-700">/</span> : null}
                <Link
                  to={item.to}
                  className={
                    index === breadcrumbs.length - 1
                      ? 'truncate text-slate-300'
                      : 'truncate hover:text-white'
                  }
                >
                  {item.label}
                </Link>
              </span>
            ))}
          </nav>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          {children}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="inline-flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 text-xs text-slate-400 transition-colors hover:border-white/20 hover:text-white"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t('palette.searchPlaceholder')}</span>
            <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px]">
              ⌘K
            </span>
          </button>
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
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
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            <Building2 className="h-4 w-4" />
          </Link>
          <Link
            to="/app/materials"
            aria-label={t('nav.materials')}
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex"
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
            className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Bell className="h-4 w-4" />
            {unread > 0 ? (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-slate-950">
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </Link>
          <Link
            to="/app/settings"
            aria-label={t('nav.settings')}
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            <Settings className="h-4 w-4" />
          </Link>
          <Link
            to="/app"
            aria-label={t('nav.projects')}
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            <LayoutDashboard className="h-4 w-4" />
          </Link>
          {user ? (
            <Link
              to="/app/settings"
              className="hidden max-w-48 truncate text-sm text-slate-300 hover:text-white sm:block"
            >
              {user.name}
            </Link>
          ) : null}
          <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 md:block">
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


      {showRail ? (
        <nav
          aria-label={t('nav.workspace')}
          className="workspace-rail fixed top-[6.75rem] bottom-0 left-0 z-30 hidden w-14 flex-col items-center gap-1 border-r border-white/10 bg-slate-900/80 py-3 backdrop-blur-xl lg:flex"
        >
          {[
            { to: '/app', label: t('nav.projects'), icon: LayoutDashboard },
            { to: '/local', label: t('local.badge'), icon: FolderOpen },
            { to: '/app/materials', label: t('nav.materials'), icon: Package },
            { to: '/app/estimates', label: t('nav.estimates'), icon: ReceiptText },
            { to: '/app/notifications', label: t('nav.notifications'), icon: Bell },
            { to: '/app/settings', label: t('nav.settings'), icon: Settings },
          ].map(({ to, label, icon: Icon }) => (
            <Tooltip key={to} label={label} side="bottom">
              <Link
                to={to}
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icon className="h-4 w-4" />
              </Link>
            </Tooltip>
          ))}
        </nav>
      ) : null}

      <CommandPalette
        open={paletteOpen}
        commands={commands}
        onClose={() => setPaletteOpen(false)}
      />
    </header>
  );
}
