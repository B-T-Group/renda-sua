import * as Sentry from '@sentry/nestjs';

/**
 * Initialize Sentry when SENTRY_DSN is set.
 * Call after secrets are loaded so DSN from Secrets Manager is available.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || Sentry.getClient()) {
    return;
  }

  Sentry.init({
    dsn,
    environment:
      process.env.DEPLOYMENT_ENV || process.env.NODE_ENV || 'development',
    release: process.env.GIT_SHA || process.env.GITHUB_SHA || undefined,
    tracesSampleRate: 0.1,
  });
}
