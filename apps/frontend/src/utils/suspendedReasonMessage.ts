type Translate = (key: string, defaultValue: string) => string;
type SuspensionCode = 'reliability_missed_orders' | 'admin' | 'unknown';

export function suspendedReasonMessage(
  code: SuspensionCode | undefined,
  t: Translate
): string {
  if (code === 'reliability_missed_orders') {
    return t(
      'business.lifecycle.suspendedReason.reliability',
      'Suspended after too many unanswered orders in the last 30 days.'
    );
  }
  if (code === 'admin') {
    return t(
      'business.lifecycle.suspendedReason.admin',
      'Suspended by Rendasua after an account review.'
    );
  }
  return t(
    'business.lifecycle.suspendedReason.unknown',
    'Your store was suspended and cannot accept orders.'
  );
}
