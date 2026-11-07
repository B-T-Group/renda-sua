export interface CheckoutDisabledReasonInput {
  recipientIncomplete: boolean;
  recipientAddressMissing: boolean;
  momoMissing: boolean;
  blockerCode?: string | null;
  blockerMessage?: string | null;
  addressMissing: boolean;
  windowMissing: boolean;
  loading: boolean;
  recipientIncompleteText: string;
  recipientAddressText: string;
  momoText: string;
  addressText: string;
  windowText: string;
  loadingText: string;
}

export type CheckoutStickyBlocker =
  | 'recipient'
  | 'recipient_address'
  | 'momo'
  | 'blocker'
  | 'address'
  | 'window'
  | 'loading';

/** First reason the shopper can act on. Does not decide whether submit is allowed. */
export function checkoutStickyDisabledReasonCode(
  input: CheckoutDisabledReasonInput
): CheckoutStickyBlocker | undefined {
  if (input.recipientIncomplete) return 'recipient';
  if (input.recipientAddressMissing) return 'recipient_address';
  if (input.momoMissing) return 'momo';
  if (input.blockerMessage && input.blockerCode !== 'COOKED_FOOD_STORE_CLOSED') {
    return 'blocker';
  }
  if (input.addressMissing) return 'address';
  if (input.windowMissing) return 'window';
  if (input.loading) return 'loading';
  return undefined;
}

const BLOCKER_TEXT: Record<
  Exclude<CheckoutStickyBlocker, 'blocker'>,
  keyof CheckoutDisabledReasonInput
> = {
  recipient: 'recipientIncompleteText',
  recipient_address: 'recipientAddressText',
  momo: 'momoText',
  address: 'addressText',
  window: 'windowText',
  loading: 'loadingText',
};

/** Copy for the first reason the shopper can act on. */
export function checkoutStickyDisabledReason(
  input: CheckoutDisabledReasonInput
): string | undefined {
  const code = checkoutStickyDisabledReasonCode(input);
  if (!code) return undefined;
  if (code === 'blocker') return input.blockerMessage || undefined;
  const text = input[BLOCKER_TEXT[code]];
  return typeof text === 'string' ? text : undefined;
}
