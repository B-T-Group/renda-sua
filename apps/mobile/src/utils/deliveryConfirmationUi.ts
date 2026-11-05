import {
  CLIENT_CONFIRM_COMPLETABLE_STATUSES,
  type AgentConfirmMessageKey,
  type DeliveryConfirmationState,
} from '../types/deliveryConfirmation';

export type ClientConfirmVisibilityInput = {
  status?: string | null;
  fulfillmentMethod?: string | null;
  isGift?: boolean | null;
  giftBuyerCanConfirm?: boolean | null;
  usesLegacyPin?: boolean | null;
  paymentTiming?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  payAfterMerchantConfirm?: boolean | null;
};

export function isClientConfirmCompletableStatus(status?: string | null): boolean {
  return (CLIENT_CONFIRM_COMPLETABLE_STATUSES as readonly string[]).includes(
    status ?? ''
  );
}

export function isDeliveryFulfillment(method?: string | null): boolean {
  return method !== 'pickup' && method !== 'shipping';
}

/**
 * Gift-buyer confirm is gated on GET `giftBuyerCanConfirm` (may flip).
 * Non-gift clients can confirm from completable statuses without that flag.
 */
export function clientCanShowConfirmReceipt(
  input: ClientConfirmVisibilityInput
): boolean {
  if (!isDeliveryFulfillment(input.fulfillmentMethod)) return false;
  if (input.usesLegacyPin === true) return false;
  if (!isClientConfirmCompletableStatus(input.status)) return false;
  if (hidesUnpaidDoorstepConfirm(input)) return false;
  if (input.isGift) return input.giftBuyerCanConfirm === true;
  return true;
}

/** Doorstep collection is still open. Confirm would skip the MoMo prompt. */
function hidesUnpaidDoorstepConfirm(input: ClientConfirmVisibilityInput): boolean {
  if (input.status !== 'out_for_delivery') return false;
  if (input.payAfterMerchantConfirm === true) return false;
  const doorstep =
    input.paymentTiming === 'pay_at_delivery' ||
    input.paymentMethod === 'pay_on_delivery';
  if (!doorstep) return false;
  return input.paymentStatus !== 'paid' && input.paymentStatus !== 'authorized';
}

export function clientShowPendingAutoCompleteNotice(
  state: Pick<DeliveryConfirmationState, 'status' | 'photos'> | null | undefined
): boolean {
  return state?.status === 'pending_auto_complete' && (state.photos?.length ?? 0) > 0;
}

export function resolveUsesLegacyPin(
  state: Pick<DeliveryConfirmationState, 'usesLegacyPin'> | null | undefined
): boolean {
  return state?.usesLegacyPin === true;
}

export function agentWaitingCopy(
  key: AgentConfirmMessageKey | null | undefined
): { i18nKey: string; fallback: string } {
  if (key === 'agent.nonstripe') {
    return {
      i18nKey: 'orders.clientConfirm.agentNonstripe',
      fallback: 'Waiting for the client. Contact support if needed.',
    };
  }
  return {
    i18nKey: 'orders.clientConfirm.agentWaiting',
    fallback: 'Waiting for the client to confirm',
  };
}

export function shouldFetchDeliveryConfirmation(
  status?: string | null,
  fulfillmentMethod?: string | null
): boolean {
  if (!isDeliveryFulfillment(fulfillmentMethod)) return false;
  return (
    isClientConfirmCompletableStatus(status) ||
    status === 'disputed' ||
    status === 'arrived'
  );
}
