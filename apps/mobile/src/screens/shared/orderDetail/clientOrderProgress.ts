/** Étapes principales alignées web / `OrderDetailClientView` historique. */
export const CLIENT_PROGRESS_KEYS = [
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'assigned_to_agent',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
] as const;

export function clientProgressIndex(status: string | undefined): number {
  if (!status) return 0;
  const normalized =
    status === 'complete' ? 'delivered' : status === 'pending_payment' ? 'pending' : status;
  const i = CLIENT_PROGRESS_KEYS.indexOf(normalized as (typeof CLIENT_PROGRESS_KEYS)[number]);
  if (i >= 0) return i;
  if (['cancelled', 'failed', 'refunded'].includes(status)) return -1;
  return 0;
}

export function clientProgressPercent(status: string | undefined): number {
  if (!status) return 0;
  if (['cancelled', 'failed', 'refunded'].includes(status)) return 0;
  if (status === 'complete') return 100;
  const i = clientProgressIndex(status);
  if (i < 0) return 0;
  const max = CLIENT_PROGRESS_KEYS.length - 1;
  return Math.round((i / max) * 100);
}
