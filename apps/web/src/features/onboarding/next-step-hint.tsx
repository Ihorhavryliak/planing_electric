import type { OnboardingHint } from '@drawmyplace/contracts';
import { ArrowRight, Lightbulb, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, buttonVariants } from '@/components/ui/button';
import { useI18n } from '@/features/i18n/i18n-context';
import { useOnboarding } from '@/features/onboarding/onboarding-context';
import { cn } from '@/lib/utils';

export interface NextStep {
  id: OnboardingHint;
  titleKey: string;
  bodyKey: string;
  actionLabelKey: string;
  /** Called when the user follows the hint. */
  onAction?: () => void;
  /** Renders the action as an in-app link instead of a button. */
  href?: string;
}

interface NextStepHintProps {
  steps: readonly NextStep[];
  className?: string;
}

/**
 * Compact, state-aware guidance shown after the first tour. Only one hint is
 * visible at a time and dismissing it stores the milestone for the account.
 */
export function NextStepHint({ steps, className }: NextStepHintProps) {
  const { t } = useI18n();
  const { state, markHint, shouldShowTour } = useOnboarding();

  if (shouldShowTour) return null;

  const step = steps.find((item) => !state.hints[item.id]);
  if (!step) return null;

  return (
    <section
      data-testid="next-step-hint"
      className={cn(
        'editor-panel border-amber-400/25 p-4',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-300" />
          <h2 className="text-sm font-semibold text-white">
            {t(step.titleKey)}
          </h2>
        </div>
        <button
          type="button"
          aria-label={t('hint.dismiss')}
          onClick={() => markHint(step.id)}
          className="rounded-lg p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
        {t(step.bodyKey)}
      </p>
      <div className="mt-3">
        {step.href ? (
          <Link
            to={step.href}
            onClick={() => markHint(step.id)}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            {t(step.actionLabelKey)}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              markHint(step.id);
              step.onAction?.();
            }}
          >
            {t(step.actionLabelKey)}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </section>
  );
}
