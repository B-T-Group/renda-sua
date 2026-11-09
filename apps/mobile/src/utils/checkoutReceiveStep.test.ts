import { describe, expect, it } from 'vitest';
import {
  checkoutReceiveDisabledReason,
  checkoutReviewDisabledReason,
  isCheckoutBackNavigation,
} from './checkoutReceiveStep';

const texts = {
  recipientIncompleteText: 'recipient',
  recipientAddressText: 'recipient address',
  momoText: 'momo',
  addressText: 'address',
  windowText: 'window',
  loadingText: 'loading',
};

function base(
  overrides: Partial<Parameters<typeof checkoutReceiveDisabledReason>[0]> = {}
) {
  return {
    recipientIncomplete: false,
    recipientAddressMissing: false,
    momoMissing: false,
    addressMissing: false,
    windowMissing: false,
    loading: false,
    ...texts,
    ...overrides,
  };
}

describe('checkoutReceiveDisabledReason', () => {
  it('ignores a missing MoMo number so Continue is not blocked', () => {
    expect(checkoutReceiveDisabledReason(base({ momoMissing: true }))).toBeUndefined();
    expect(
      checkoutReceiveDisabledReason(base({ momoMissing: true, windowMissing: true }))
    ).toBe('window');
  });

  it('still names a missing address or window', () => {
    expect(checkoutReceiveDisabledReason(base({ addressMissing: true }))).toBe('address');
    expect(checkoutReceiveDisabledReason(base({ windowMissing: true }))).toBe('window');
  });

  it('blocks Continue on a missing recipient address and still ignores MoMo', () => {
    expect(
      checkoutReceiveDisabledReason(
        base({ recipientAddressMissing: true, momoMissing: true, windowMissing: true })
      )
    ).toBe('recipient address');
  });
});

describe('checkoutReviewDisabledReason', () => {
  it('keeps MoMo and loading, and ignores address or window leftovers', () => {
    expect(checkoutReviewDisabledReason(base({ momoMissing: true }))).toBe('momo');
    expect(checkoutReviewDisabledReason(base({ loading: true }))).toBe('loading');
    expect(
      checkoutReviewDisabledReason(
        base({ addressMissing: true, windowMissing: true, momoMissing: true })
      )
    ).toBe('momo');
    expect(
      checkoutReviewDisabledReason(
        base({
          recipientIncomplete: true,
          recipientAddressMissing: true,
          blockerCode: 'OTHER',
          blockerMessage: 'Out of range',
        })
      )
    ).toBe('Out of range');
  });
});

describe('isCheckoutBackNavigation', () => {
  it('treats back and pop as back, and reset/navigate as leave', () => {
    expect(isCheckoutBackNavigation('GO_BACK')).toBe(true);
    expect(isCheckoutBackNavigation('POP')).toBe(true);
    expect(isCheckoutBackNavigation('POP_TO_TOP')).toBe(true);
    expect(isCheckoutBackNavigation('RESET')).toBe(false);
    expect(isCheckoutBackNavigation('NAVIGATE')).toBe(false);
    expect(isCheckoutBackNavigation('REPLACE')).toBe(false);
  });
});
