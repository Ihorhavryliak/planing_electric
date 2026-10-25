import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CircleX,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, buttonVariants } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { type CheckState, useSystemHealth } from '@/hooks/use-system-health';
import { cn } from '@/lib/utils';

const statusText: Record<CheckState, string> = {
  checking: 'Checking',
  up: 'Online',
  down: 'Offline',
};

function StatusIcon({ state }: { state: CheckState }) {
  if (state === 'checking') {
    return <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />;
  }

  if (state === 'up') {
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  }

  return <CircleX className="h-4 w-4 text-rose-400" />;
}

const foundations = [
  {
    title: 'Monorepo and shared tooling',
    description:
      'pnpm workspaces, Turborepo, a shared TypeScript baseline, ESLint, and one command for every check.',
  },
  {
    title: 'API foundation',
    description:
      'NestJS with a versioned /api/v1 prefix, environment validation, normalized errors, security headers, and liveness/readiness endpoints.',
  },
  {
    title: 'Authentication and sessions',
    description:
      'Registration, login, logout, and current-user endpoints with Argon2id password hashing, hashed server-side sessions, and rate limiting.',
  },
  {
    title: 'Database foundation',
    description:
      'PostgreSQL schema defined with Drizzle ORM, tracked migrations, and fast PGlite tests for schema and auth flows.',
  },
  {
    title: 'Web foundation',
    description:
      'React, Vite, and Tailwind CSS with login and registration pages, a protected workspace, and live API status.',
  },
  {
    title: 'Shared contracts',
    description:
      'Zod schemas and inferred TypeScript types that both the API and the web app can consume.',
  },
];

const nextSteps = [
  'Project CRUD with server-side ownership checks and IDOR protection.',
  'The editor shell: canonical coordinates, pan, zoom, and save/reload.',
  'Cable length calculations, material lists, and estimate export.',
];

const capabilities = [
  {
    title: 'Read the plan',
    description:
      'Start from a blank canvas or calibrate an uploaded JPG, PNG, or PDF against a known distance.',
  },
  {
    title: 'Draw the electrics',
    description:
      'Place sockets, switches, lights, and panels, then trace cable routes over the plan.',
  },
  {
    title: 'Know the quantity',
    description:
      'Turn routes into tested cable lengths, add drops and waste, and export a material list.',
  },
];

export function LandingPage() {
  const health = useSystemHealth();
  const { status } = useAuth();
  const checkedAt = health.checkedAt
    ? new Intl.DateTimeFormat('en', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(health.checkedAt))
    : 'not checked yet';

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="app-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -top-48 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-12">
        <header className="flex flex-wrap items-center justify-between gap-4 py-6">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-slate-950 shadow-lg shadow-amber-400/20">
              <Zap className="h-5 w-5" fill="currentColor" />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-wide text-white">
                DrawMyPlace
              </p>
              <p className="text-xs text-slate-400">
                Electrical installation planning
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <span className="mr-2 hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 md:inline-flex">
              Phase 2 · Authentication
            </span>

            {status === 'authenticated' ? (
              <Link
                to="/app"
                className={cn(buttonVariants({ size: 'sm' }))}
              >
                Open workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className={cn(buttonVariants({ size: 'sm' }))}
                >
                  Create account
                </Link>
              </>
            )}
          </div>
        </header>

        <main id="main-content" className="flex-1">
          <section className="grid items-center gap-10 py-14 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-xs font-medium text-amber-200">
                <Sparkles className="h-3.5 w-3.5" />
                Accounts are live
              </span>

              <h1 className="mt-6 max-w-2xl text-5xl leading-[1.05] font-semibold tracking-tight text-white sm:text-6xl">
                Electrical plans that{' '}
                <span className="text-amber-300">add up.</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
                DrawMyPlace turns a floor plan into placed points, routed cable,
                and a material estimate you can defend. Create an account to
                enter the workspace — projects and the drawing editor are next.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {status === 'authenticated' ? (
                  <Link to="/app" className={cn(buttonVariants())}>
                    Open your workspace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Link to="/register" className={cn(buttonVariants())}>
                    Create your account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
                <a
                  href="#foundation"
                  className="inline-flex h-10 items-center rounded-lg border border-white/15 bg-white/5 px-4 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
                >
                  What works today
                </a>
              </div>

              <p className="mt-4 text-xs text-slate-500">
                Last live check: {checkedAt}
              </p>
            </div>

            <aside className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    System check
                  </h2>
                  <p className="mt-1 text-xs text-slate-400">
                    Results come from the running API, not static placeholders.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Refresh system check"
                  onClick={health.refresh}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <StatusIcon state={health.api} />
                    <span className="text-sm text-slate-200">API</span>
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium',
                      health.api === 'up' && 'text-emerald-300',
                      health.api === 'down' && 'text-rose-300',
                      health.api === 'checking' && 'text-slate-400',
                    )}
                  >
                    {statusText[health.api]}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <StatusIcon state={health.database} />
                    <span className="text-sm text-slate-200">PostgreSQL</span>
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium',
                      health.database === 'up' && 'text-emerald-300',
                      health.database === 'down' && 'text-rose-300',
                      health.database === 'checking' && 'text-slate-400',
                    )}
                  >
                    {statusText[health.database]}
                  </span>
                </div>
              </div>

              {health.database === 'down' && health.api === 'up' ? (
                <div className="mt-4 flex gap-2.5 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs leading-relaxed text-amber-100">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    The API is running, but PostgreSQL is not reachable. Start
                    it with <code className="font-mono">pnpm db:up</code> and
                    run <code className="font-mono">pnpm db:migrate</code>.
                  </p>
                </div>
              ) : null}

              {health.api === 'down' ? (
                <div className="mt-4 flex gap-2.5 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-xs leading-relaxed text-rose-100">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    The API is not reachable. Start the development stack with{' '}
                    <code className="font-mono">pnpm dev</code>.
                  </p>
                </div>
              ) : null}
            </aside>
          </section>

          <section className="grid gap-4 pb-16 md:grid-cols-3">
            {capabilities.map((capability) => (
              <article
                key={capability.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <p className="text-xs font-medium tracking-widest text-amber-300/80 uppercase">
                  Product direction
                </p>
                <h3 className="mt-2 text-base font-semibold text-white">
                  {capability.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {capability.description}
                </p>
              </article>
            ))}
          </section>

          <section
            id="foundation"
            className="grid gap-10 border-t border-white/10 py-14 lg:grid-cols-[0.9fr_1.1fr]"
          >
            <div>
              <p className="text-xs font-medium tracking-widest text-amber-300/80 uppercase">
                Verified foundation
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                What works today
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                Every item below is backed by code in this repository and by
                commands that can be re-run: install, typecheck, lint, tests, and
                a production build.
              </p>

              <div className="mt-8 rounded-2xl border border-white/10 bg-slate-900/60 p-5">
                <h3 className="text-sm font-semibold text-white">Next up</h3>
                <ul className="mt-3 space-y-2.5">
                  {nextSteps.map((step) => (
                    <li
                      key={step}
                      className="flex gap-2.5 text-sm text-slate-400"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {foundations.map((item) => (
                <article
                  key={item.title}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <h3 className="text-sm font-medium text-white">
                      {item.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">
                    {item.description}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </main>

        <footer className="flex flex-col gap-2 border-t border-white/10 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>DrawMyPlace · Phase 2 authentication</p>
          <p>React · NestJS · PostgreSQL · Drizzle · Zod</p>
        </footer>
      </div>
    </div>
  );
}
