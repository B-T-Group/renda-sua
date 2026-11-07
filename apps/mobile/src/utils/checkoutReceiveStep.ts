import type { CheckoutDisabledReasonInput } from './checkoutStickyDisabledReason';
import { checkoutStickyDisabledReason } from './checkoutStickyDisabledReason';

export type CheckoutFlowStep = 'receive' | 'review';

/** Receive-step sticky reason: MoMo is collected on review, so it never blocks Continue. */
export function checkoutReceiveDisabledReason(
  input: CheckoutDisabledReasonInput
): string | undefined {
  return checkoutStickyDisabledReason({ ...input, momoMissing: false });
}

/** Review-step sticky reason: only payment / loading / leftover blockers. */
export function checkoutReviewDisabledReason(
  input: CheckoutDisabledReasonInput
): string | undefined {
  return checkoutStickyDisabledReason({
    ...input,
    recipientIncomplete: false,
    recipientAddressMissing: false,
    addressMissing: false,
    windowMissing: false,
  });
}
