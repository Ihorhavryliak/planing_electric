import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { useI18n } from '@/features/i18n/i18n-context';
import { cn } from '@/lib/utils';
import editorPreview from '@/assets/editor-preview.png';

const capabilities = [
  { titleKey: 'landing.cap.read', hintKey: 'landing.cap.readHint' },
  { titleKey: 'landing.cap.draw', hintKey: 'landing.cap.drawHint' },
  { titleKey: 'landing.cap.quantity', hintKey: 'landing.cap.quantityHint' },
];

const features = [
  'landing.item.auth',
  'landing.item.editor',
  'landing.item.calc',
  'landing.item.estimates',
  'landing.item.3d',
  'landing.item.variants',
  'landing.item.local',
  'landing.item.i18n',
];

export function LandingPage() {
  const { t } = useI18n();
  const { status } = useAuth();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="app-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="pointer-events-none absolute -top-48 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full bg-amber-400/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-12">
        <header className="flex flex-wrap items-center justify-between gap-4 py-6">
          <Link to="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--dmp-color-brand)] text-white shadow-lg shadow-amber-400/20">
              <Zap className="h-5 w-5" fill="currentColor" />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-wide text-white">
                DrawMyPlace
              </p>
              <p className="text-xs text-slate-400">{t('landing.tagline')}</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {status === 'authenticated' ? (
              <Link to="/app" className={cn(buttonVariants({ size: 'sm' }))}>
                {t('landing.openWorkspace')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {t('auth.login.submit')}
                </Link>
                <Link
                  to="/register"
                  className={cn(buttonVariants({ size: 'sm' }))}
                >
                  {t('auth.register.submit')}
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
                {t('landing.badge')}
              </span>

              <h1 className="mt-6 max-w-2xl text-5xl leading-[1.05] font-semibold tracking-tight text-white sm:text-6xl">
                {t('landing.title')}{' '}
                <span className="text-amber-300">{t('landing.titleAccent')}</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-400">
                {t('landing.subtitle')}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                {status === 'authenticated' ? (
                  <Link to="/app" className={cn(buttonVariants())}>
                    {t('landing.openWorkspace')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Link to="/register" className={cn(buttonVariants())}>
                    {t('landing.createAccount')}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
                <Link
                  to="/local"
                  className="inline-flex h-10 items-center rounded-lg border border-white/15 bg-white/5 px-4 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
                >
                  {t('landing.tryLocal')}
                </Link>
                <a
                  href="#foundation"
                  className="inline-flex h-10 items-center rounded-lg border border-white/15 bg-white/5 px-4 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
                >
                  {t('landing.whatWorks')}
                </a>
              </div>
            </div>

            <aside className="space-y-4">
              <figure className="app-panel overflow-hidden p-2 shadow-2xl shadow-black/40">
                <div className="relative overflow-hidden rounded-xl border border-white/10">
                  <img
                    src={editorPreview}
                    alt={t('landing.previewAlt')}
                    className="aspect-[16/11] w-full object-cover object-top"
                    loading="lazy"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap gap-1.5 bg-gradient-to-t from-slate-950/95 to-transparent p-3">
                    {['2D · 3D', 'IFC4', 'XLSX', 'PDF'].map((badge) => (
                      <span
                        key={badge}
                        className="rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-100 backdrop-blur"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>
                <figcaption className="px-2 py-2 text-[11px] leading-relaxed text-slate-500">
                  {t('landing.previewHint')}
                </figcaption>
              </figure>

              <div className="app-panel p-6 shadow-2xl shadow-black/40 backdrop-blur">
                <h2 className="text-sm font-semibold text-white">
                  {t('landing.valueTitle')}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  {t('landing.valueHint')}
                </p>
                <ul className="mt-5 space-y-2.5">
                  {[
                    t('landing.value.one'),
                    t('landing.value.two'),
                    t('landing.value.three'),
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm leading-relaxed text-slate-200"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                      {item}
                    </li>
                  ))}
                </ul>
                <a
                  href="#foundation"
                  className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-[var(--dmp-color-brand)] hover:underline"
                >
                  {t('landing.whatWorks')}
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </aside>
          </section>

          <section className="grid gap-4 pb-16 md:grid-cols-3">
            {capabilities.map((capability) => (
              <article
                key={capability.titleKey}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <p className="text-xs font-medium tracking-widest text-amber-300/80 uppercase">
                  {t('landing.direction')}
                </p>
                <h3 className="mt-2 text-base font-semibold text-white">
                  {t(capability.titleKey)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  {t(capability.hintKey)}
                </p>
              </article>
            ))}
          </section>

          <section className="border-t border-white/10 py-14">
            <div className="max-w-2xl">
              <p className="text-xs font-medium tracking-widest text-amber-300/80 uppercase">
                {t('landing.workflow.eyebrow')}
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                {t('landing.workflow.title')}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                {t('landing.workflow.hint')}
              </p>
            </div>
            <ol className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                ['landing.workflow.plan', '01'],
                ['landing.workflow.circuits', '02'],
                ['landing.workflow.estimate', '03'],
                ['landing.workflow.docs', '04'],
              ].map(([key, number]) => (
                <li
                  key={key}
                  className="app-panel p-5"
                >
                  <span className="font-mono text-xs text-amber-300">
                    {number}
                  </span>
                  <h3 className="mt-2 text-sm font-semibold text-white">
                    {t(`${key}.title`)}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                    {t(`${key}.body`)}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section
            id="foundation"
            className="grid gap-10 border-t border-white/10 py-14 lg:grid-cols-[0.9fr_1.1fr]"
          >
            <div>
              <p className="text-xs font-medium tracking-widest text-amber-300/80 uppercase">
                {t('landing.verified')}
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                {t('landing.worksTitle')}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                {t('landing.worksHint')}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {features.map((key) => (
                <article
                  key={key}
                  className="flex gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <p className="text-sm leading-relaxed text-slate-300">
                    {t(key)}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </main>

        <footer className="flex flex-col gap-2 border-t border-white/10 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>{t('landing.footer')}</p>
          <p>© 2026 DrawMyPlace</p>
        </footer>
      </div>
    </div>
  );
}
