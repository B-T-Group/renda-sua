import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';

/**
 * Report a money-path anomaly that should never (or only rarely) happen.
 *
 * Always logs at error level with a greppable marker. When Sentry is
 * initialised (SENTRY_DSN set) it also raises a Sentry event so on-call is
 * alerted; without a client `captureMessage` is a no-op, so this is safe in
 * tests and local development.
 *
 * The Sentry issue is fingerprinted by `marker` only. Unique order / tx /
 * reference text stays in extras (`detail`) so extra collects increment one
 * issue instead of opening a new Sentry issue per payment.
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
      scope.setExtras({ ...context, detail: message });
      scope.setFingerprint(['money_anomaly', marker]);
      Sentry.captureMessage(marker, 'error');
    });
  } catch {
    // Alerting must never break the money flow it is reporting on.
  }
}
