import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';

/**
 * Report a money-path anomaly that should never (or only rarely) happen.
 *
 * Always logs at error level with a greppable marker. When Sentry is
 * initialised (SENTRY_DSN set) it also raises a Sentry event so on-call is
 * alerted; without a client `captureMessage` is a no-op, so this is safe in
 * tests and local development.
 */
export function reportMoneyAnomaly(
  logger: Logger,
  marker: string,
  message: string,
  context: Record<string, string | number | boolean | null | undefined> = {}
): void {
  logger.error(`${marker} ${message}`);
  try {
    Sentry.withScope((scope) => {
      scope.setTag('money_anomaly', marker);
      scope.setLevel('error');
      scope.setExtras(context);
      Sentry.captureMessage(`${marker}: ${message}`, 'error');
    });
  } catch {
    // Alerting must never break the money flow it is reporting on.
  }
}
