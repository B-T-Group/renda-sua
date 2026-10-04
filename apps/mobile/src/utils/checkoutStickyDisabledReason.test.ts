import { describe, expect, it } from 'vitest';
import { checkoutStickyDisabledReason } from './checkoutStickyDisabledReason';

const texts = {
  recipientIncompleteText: 'recipient',
  recipientAddressText: 'recipient address',
  momoText: 'momo',
  addressText: 'address',
  windowText: 'window',
  loadingText: 'loading',
};

function reason(
  overrides: Partial<Parameters<typeof checkoutStickyDisabledReason>[0]>
) {
  return checkoutStickyDisabledReason({
    recipientIncomplete: false,
    recipientAddressMissing: false,
    momoMissing: false,
    addressMissing: false,
    windowMissing: false,
    loading: false,
    ...texts,
    ...overrides,
  });
}

describe('checkoutStickyDisabledReason', () => {
  it('keeps the recipient and MoMo reasons ahead of later blocks', () => {
    expect(reason({ recipientIncomplete: true, addressMissing: true })).toBe('recipient');
    expect(reason({ momoMissing: true, loading: true })).toBe('momo');
  });

  it('names a missing address, a missing window, and a price that is still loading', () => {
    expect(reason({ addressMissing: true })).toBe('address');
    expect(reason({ windowMissing: true })).toBe('window');
    expect(reason({ loading: true })).toBe('loading');
  });

  it('shows a checkout blocker and skips the kitchen-closed panel message', () => {
    expect(reason({ blockerCode: 'OTHER', blockerMessage: 'Closed for lunch' })).toBe(
      'Closed for lunch'
    );
    expect(
      reason({
        blockerCode: 'COOKED_FOOD_STORE_CLOSED',
        blockerMessage: 'Kitchen closed',
        addressMissing: true,
      })
    ).toBe('address');
  });
});
