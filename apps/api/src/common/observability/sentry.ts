import * as Sentry from '@sentry/node';

let initialized = false;

/** Enables Sentry when a DSN is configured; otherwise all calls are no-ops. */
export function initErrorReporting(dsn: string | undefined): void {
  if (!dsn || initialized) {
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
  });
  initialized = true;
}

export function captureException(
  exception: unknown,
  context?: { requestId?: string; path?: string; method?: string },
): void {
  if (!initialized) {
    return;
  }

  Sentry.withScope((scope) => {
    if (context?.requestId) scope.setTag('request_id', context.requestId);
    if (context?.path) scope.setTag('path', context.path);
    if (context?.method) scope.setTag('method', context.method);
    Sentry.captureException(exception);
  });
}
