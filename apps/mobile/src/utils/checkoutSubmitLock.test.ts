import { describe, expect, it } from 'vitest';
import {
  createCheckoutSubmitLock,
  shouldKeepCheckoutSubmitting,
} from './checkoutSubmitLock';

describe('createCheckoutSubmitLock', () => {
  it('rejects a second acquire until released', () => {
    const lock = createCheckoutSubmitLock();
    expect(lock.tryAcquire()).toBe(true);
    expect(lock.tryAcquire()).toBe(false);
    expect(lock.isLocked()).toBe(true);
    lock.release();
    expect(lock.tryAcquire()).toBe(true);
  });
});

describe('shouldKeepCheckoutSubmitting', () => {
  it('keeps the button locked after a successful or pending order', () => {
    expect(shouldKeepCheckoutSubmitting('success')).toBe(true);
    expect(shouldKeepCheckoutSubmitting('pending')).toBe(true);
  });

  it('unlocks on error, cancel, or ignored duplicate tap', () => {
    expect(shouldKeepCheckoutSubmitting('error')).toBe(false);
    expect(shouldKeepCheckoutSubmitting('cancelled')).toBe(false);
    expect(shouldKeepCheckoutSubmitting('busy')).toBe(false);
  });
});
