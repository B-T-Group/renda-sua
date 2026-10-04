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

/** First reason the shopper can act on. Does not decide whether submit is allowed. */
export function checkoutStickyDisabledReason(
  input: CheckoutDisabledReasonInput
): string | undefined {
  if (input.recipientIncomplete) return input.recipientIncompleteText;
  if (input.recipientAddressMissing) return input.recipientAddressText;
  if (input.momoMissing) return input.momoText;
  if (
    input.blockerMessage &&
    input.blockerCode !== 'COOKED_FOOD_STORE_CLOSED'
  ) {
    return input.blockerMessage;
  }
  if (input.addressMissing) return input.addressText;
  if (input.windowMissing) return input.windowText;
  if (input.loading) return input.loadingText;
  return undefined;
}
