import { ArrowLeft, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/features/i18n/i18n-context';
import { WorkspaceHeader } from '@/features/workspace/workspace-header';

const plans = [
  {
    nameKey: 'pricing.free',
    price: '0',
    featureKeys: [
      'pricing.feature.personal',
      'pricing.feature.underlays',
      'pricing.feature.calculations',
      'pricing.feature.estimates',
    ],
  },
  {
    nameKey: 'pricing.team',
    price: 'soon',
    featureKeys: [
      'pricing.feature.orgs',
      'pricing.feature.shared',
      'pricing.feature.teamPrices',
      'pricing.feature.activity',
    ],
  },
];

export function PricingPage() {
  const { t } = useI18n();

  return (
    <div className="relative min-h-screen">
      <WorkspaceHeader badge={t('pricing.badge')} />
      <main id="main-content" className="page-shell">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('pricing.home')}
        </Link>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white">
          {t('pricing.title')}
        </h1>
        <p className="mt-2 text-sm text-slate-400">{t('pricing.subtitle')}</p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {plans.map((plan) => (
            <section
              key={plan.nameKey}
              className="app-panel p-6"
            >
              <h2 className="text-lg font-semibold text-white">
                {t(plan.nameKey)}
              </h2>
              <p className="mt-2 text-3xl font-semibold text-amber-300">
                {plan.price === 'soon' ? t('pricing.soon') : plan.price}
                {plan.price !== 'soon' ? (
                  <span className="text-sm font-normal text-slate-400">
                    {' '}
                    {t('pricing.perMonth')}
                  </span>
                ) : null}
              </p>
              <ul className="mt-5 space-y-2 text-sm text-slate-300">
                {plan.featureKeys.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-300" />
                    {t(feature)}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
