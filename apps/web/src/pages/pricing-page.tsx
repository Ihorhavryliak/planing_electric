import { ArrowLeft, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { WorkspaceHeader } from '@/features/workspace/workspace-header';

const plans = [
  {
    name: 'Free',
    price: '0',
    features: [
      'Personal projects',
      'Blank plans and underlays',
      'Cable calculations',
      'CSV and PDF estimates',
    ],
  },
  {
    name: 'Team',
    price: 'Soon',
    features: [
      'Organizations and roles',
      'Shared project access',
      'Team material prices',
      'Activity history',
    ],
  },
];

export function PricingPage() {
  return (
    <div className="relative min-h-screen">
      <WorkspaceHeader badge="Pricing" />
      <main id="main-content" className="mx-auto max-w-5xl px-6 py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Home
        </Link>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white">
          Simple pricing
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Start free. Team features are in active development.
        </p>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {plans.map((plan) => (
            <section
              key={plan.name}
              className="rounded-2xl border border-white/10 bg-slate-900/60 p-6"
            >
              <h2 className="text-lg font-semibold text-white">{plan.name}</h2>
              <p className="mt-2 text-3xl font-semibold text-amber-300">
                {plan.price}
                {plan.price !== 'Soon' ? (
                  <span className="text-sm font-normal text-slate-400">
                    {' '}
                    / month
                  </span>
                ) : null}
              </p>
              <ul className="mt-5 space-y-2 text-sm text-slate-300">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-300" />
                    {feature}
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