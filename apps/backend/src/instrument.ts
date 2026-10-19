import * as Sentry from '@sentry/nestjs';
import { redactSensitivePathsDeep } from './common/redact-sensitive-path.util';
import { scrubSentryEvent } from './common/sentry/scrub-sentry-event';

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
    // Never attach request bodies or cookies (webhook bodies carry live provider secrets).
    integrations: [
      Sentry.requestDataIntegration({ include: { data: false, cookies: false } }),
    ],
    beforeSend: sentryBeforeSend,
    beforeSendTransaction: sentryBeforeSendTransaction,
  });
}

/**
 * Both scrubbers, fail closed (QA #589 D3, #593 merged-result spec):
 * - scrubSentryEvent (#589): request bodies/cookies, credentials and provider secrets;
 * - redactSensitivePathsDeep (#593): path tokens such as /secret-refresh/<token>.
 * An event we could not fully scrub is never sent. Returning null from the hook drops it;
 * letting the hook throw would make the SDK send its own "Event processing pipeline threw"
 * event instead.
 */
export function scrubAll<E>(event: E): E | null {
  try {
    return redactSensitivePathsDeep(scrubSentryEvent(event) as unknown as object) as unknown as E;
  } catch {
    return null;
  }
}

/** Drops expected-unavailable noise, then scrubs bodies, credentials and secrets. */
export function sentryBeforeSend<E>(event: E, hint?: { originalException?: unknown }): E | null {
  if (isExpectedUnavailable(hint?.originalException)) return null;
  return scrubAll(event);
}

export function sentryBeforeSendTransaction<E>(event: E): E | null {
  return scrubAll(event);
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
