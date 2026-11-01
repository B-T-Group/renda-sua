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
};

export function isClientConfirmCompletableStatus(status?: string | null): boolean {
  return (CLIENT_CONFIRM_COMPLETABLE_STATUSES as readonly string[]).includes(
    status ?? ''
  );
}

export function isDeliveryFulfillment(method?: string | null): boolean {
  return method !== 'pickup' && method !== 'shipping';
}

export function clientCanShowConfirmReceipt(
  input: ClientConfirmVisibilityInput
): boolean {
  if (!isDeliveryFulfillment(input.fulfillmentMethod)) return false;
  if (input.usesLegacyPin === true) return false;
  if (!isClientConfirmCompletableStatus(input.status)) return false;
  if (input.isGift) return input.giftBuyerCanConfirm === true;
  return true;
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
