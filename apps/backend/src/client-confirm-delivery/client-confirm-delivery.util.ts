import {
  AWAITING_CLIENT_CONFIRMATION,
  CLIENT_CONFIRM_COMPLETABLE_FROM,
  OVERWRITE_ALLOWED_STATUSES,
  PENDING_AUTO_COMPLETE,
} from './client-confirm-delivery.constants';

export function usesLegacyDeliveryPin(order: {
  delivery_pin_hash?: string | null;
  fulfillment_method?: string | null;
}): boolean {
  if (order.fulfillment_method === 'pickup') return false;
  return !!order.delivery_pin_hash?.trim();
}

/** Doorstep delivery PIN is never minted for new orders. Pickup PIN is a separate path. */
export function shouldMintDeliveryPin(_order?: {
  fulfillment_method?: string | null;
}): boolean {
  return false;
}

export function isClientConfirmDeliveryOrder(order: {
  delivery_pin_hash?: string | null;
  fulfillment_method?: string | null;
}): boolean {
  if (order.fulfillment_method === 'pickup') return false;
  if (order.fulfillment_method === 'shipping') return false;
  return !usesLegacyDeliveryPin(order);
}

export function canConfirmFromStatus(status: string | null | undefined): boolean {
  return (CLIENT_CONFIRM_COMPLETABLE_FROM as readonly string[]).includes(
    status ?? ''
  );
}

export function canOverwriteFromStatus(status: string | null | undefined): boolean {
  return (OVERWRITE_ALLOWED_STATUSES as readonly string[]).includes(status ?? '');
}

export function isAwaitingClientConfirmation(status: string | null | undefined): boolean {
  return status === AWAITING_CLIENT_CONFIRMATION;
}

export function isPendingAutoComplete(status: string | null | undefined): boolean {
  return status === PENDING_AUTO_COMPLETE;
}

export function graceElapsed(
  requestedAt: string | null | undefined,
  graceMinutes: number,
  now: Date = new Date()
): boolean {
  if (!requestedAt) return false;
  const start = Date.parse(requestedAt);
  if (Number.isNaN(start)) return false;
  return now.getTime() >= start + graceMinutes * 60_000;
}

export function hoursFromNow(hours: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + hours * 60 * 60_000);
}

export function isStripeRail(rail: string | null | undefined): boolean {
  return rail === 'stripe';
}
