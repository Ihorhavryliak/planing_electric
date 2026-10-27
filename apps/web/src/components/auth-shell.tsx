import { Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <div className="app-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[44rem] -translate-x-1/2 rounded-full bg-[var(--dmp-color-brand)]/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-[var(--dmp-color-brand)]/60 focus-visible:outline-none"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--dmp-color-brand)] text-white shadow-lg shadow-blue-500/20">
            <Zap className="h-5 w-5" fill="currentColor" />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-wide text-white">
              DrawMyPlace
            </span>
            <span className="block text-xs text-slate-400">
              Electrical installation planning
            </span>
          </span>
        </Link>

        <div className="mt-8 app-panel p-7 shadow-2xl shadow-black/40 backdrop-blur">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            {subtitle}
          </p>
          <div className="mt-6">{children}</div>
        </div>

        <div className="mt-5 text-center text-sm text-slate-400">{footer}</div>
      </div>
    </div>
  );
}
