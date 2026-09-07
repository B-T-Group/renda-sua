import { describe, expect, it } from 'vitest';
import {
  resolvePaymentMethodDisplays,
  toPaymentMethodDisplay,
} from './paymentMethodDisplay';

describe('paymentMethodDisplay', () => {
  it('maps freemopay to mobile money display', () => {
    const d = toPaymentMethodDisplay('freemopay');
    expect(d.labelKey).toBe('ftue.payments.mobileMoney');
  });

  it('maps stripe to card display', () => {
    const d = toPaymentMethodDisplay('stripe');
    expect(d.icon).toBe('credit-card-outline');
  });

  it('falls back for unknown systems', () => {
    const d = toPaymentMethodDisplay('future_wallet');
    expect(d.labelKey).toBe('ftue.payments.mobileMoneyGeneric');
  });

  it('includes shopping flexibility extras', () => {
    const list = resolvePaymentMethodDisplays(['stripe']);
    expect(list.some((m) => m.systemName === 'pay_at_delivery')).toBe(true);
    expect(list.some((m) => m.systemName === 'pickup')).toBe(true);
  });

  it('uses generic fallback when empty', () => {
    const list = resolvePaymentMethodDisplays([]);
    expect(list.length).toBeGreaterThan(2);
  });
});
