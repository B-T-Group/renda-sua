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
    beforeSend(event, hint) {
      return isExpectedUnavailable(hint?.originalException) ? null : event;
    },
  });
}

const EXPECTED_UNAVAILABLE_MESSAGES = [
  'Temporarily unable to reach the data service',
  'Temporarily unable to load user profile',
  'Temporarily unable to complete this request',
];

export function isExpectedUnavailable(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  return EXPECTED_UNAVAILABLE_MESSAGES.some((text) => message.includes(text));
}
