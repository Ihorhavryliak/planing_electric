import { Check, Sparkles, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/features/i18n/i18n-context';

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  const { t } = useI18n();
  const points = [
    t('auth.aside.point1'),
    t('auth.aside.point2'),
    t('auth.aside.point3'),
  ];

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-border bg-card p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="pointer-events-none absolute -top-32 -left-24 size-[28rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] [background-size:56px_56px] opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_72%)]" />

        <Link
          to="/"
          className="relative inline-flex w-fit items-center gap-3 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Zap className="size-5" fill="currentColor" />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-tight">
              DrawMyPlace
            </span>
            <span className="block text-xs text-muted-foreground">
              {t('landing.tagline')}
            </span>
          </span>
        </Link>

        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-[11px] font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            {t('auth.aside.eyebrow')}
          </span>
          <h2 className="mt-6 text-4xl leading-[1.08] font-semibold tracking-tight text-balance xl:text-5xl">
            {t('auth.aside.title')}
          </h2>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
            {t('auth.aside.subtitle')}
          </p>
          <ul className="mt-8 space-y-3">
            {points.map((point) => (
              <li
                key={point}
                className="flex items-center gap-3 text-sm text-foreground"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="size-3" />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-muted-foreground">
          {t('auth.aside.footnote')}
        </p>
      </aside>

      <main className="relative flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-3 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 lg:hidden"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Zap className="size-5" fill="currentColor" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              DrawMyPlace
            </span>
          </Link>

          <div className="rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm sm:p-7">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
            <div className="mt-6">{children}</div>
          </div>

          <div className="mt-5 text-center text-sm text-muted-foreground">
            {footer}
          </div>
        </div>
      </main>
    </div>
  );
}
