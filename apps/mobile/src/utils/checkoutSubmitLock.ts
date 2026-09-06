/**
 * Synchronous lock so a second Place order tap cannot start another POST /orders
 * before React re-renders `submitting`. Success/pending keep the lock until the
 * checkout screen unmounts (navigation to the success screen).
 */

export type CheckoutSubmitOutcomeType =
  | 'success'
  | 'pending'
  | 'cancelled'
  | 'error'
  | 'busy';

export function createCheckoutSubmitLock() {
  let locked = false;
  return {
    tryAcquire(): boolean {
      if (locked) return false;
      locked = true;
      return true;
    },
    release() {
      locked = false;
    },
    isLocked() {
      return locked;
    },
  };
}

export function shouldKeepCheckoutSubmitting(
  type: CheckoutSubmitOutcomeType
): boolean {
  return type === 'success' || type === 'pending';
}
