import type { DeliveryOrderViewModel } from '../orders/model';

type Translate = (
  key: string,
  defaultValue: string,
  options?: Record<string, unknown>
) => string;

function formatOverdueDuration(elapsedMs: number, t: Translate): string {
  const minutes = Math.max(1, Math.round(elapsedMs / 60_000));
  if (minutes < 60) {
    return t('agentOrder.urgency.durationMinutes', '{{mins}}m', { mins: minutes });
  }
  const hours = Math.floor(minutes / 60);
  const remMins = minutes % 60;
  if (remMins === 0) {
    return t('agentOrder.urgency.durationHours', '{{hours}}h', { hours });
  }
  return t('orders.countdown.hoursMinutes', '{{hours}}h {{mins}}m', {
    hours,
    mins: remMins,
  });
}

export function formatAgentOrderUrgencyDisplay(
  urgency: DeliveryOrderViewModel['urgency'],
  now: Date,
  t: Translate
): { text: string; overdue: boolean } | null {
  if (!urgency?.deadlineAt) return null;
  if (!urgency.overdue) {
    return { text: urgency.label, overdue: false };
  }
  const elapsed = Math.max(0, now.getTime() - new Date(urgency.deadlineAt).getTime());
  const duration = formatOverdueDuration(elapsed, t);
  return {
    text: t('agentOrder.urgency.overdue', 'Late by {{duration}}', { duration }),
    overdue: true,
  };
}
