import * as Sentry from '@sentry/react';

let initialized = false;

/**
 * Sentry is optional: without VITE_SENTRY_DSN the app behaves exactly as
 * before, and no events leave the browser.
 */
export function initErrorReporting(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (!dsn || initialized) {
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    integrations: [Sentry.browserTracingIntegration()],
  });
  initialized = true;
}
