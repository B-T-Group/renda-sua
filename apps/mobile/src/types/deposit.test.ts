import { describe, it, expect } from 'vitest';
import {
  isMoMoDepositCheckoutPath,
  preflightDepositCopy,
  resolveDepositAmount,
} from './deposit';

describe('resolveDepositAmount', () => {
  it('prefers a positive server deposit_amount', () => {
    expect(resolveDepositAmount(3000, 200)).toBe(200);
    expect(resolveDepositAmount(10000, 500)).toBe(500);
  });

  it('returns 0 when the server did not quote a deposit', () => {
    expect(resolveDepositAmount(3000, null)).toBe(0);
    expect(resolveDepositAmount(10000, undefined)).toBe(0);
    expect(resolveDepositAmount(3000, 0)).toBe(0);
    expect(resolveDepositAmount(3000, -50)).toBe(0);
  });
});

describe('preflightDepositCopy', () => {
  it('reads the shared percent and the minimum flag from the first group', () => {
    expect(
      preflightDepositCopy({
        groups: [{ deposit_percent: 10, deposit_minimum_applied: false }],
      })
    ).toEqual({ minimumApplied: false, percent: 10 });
  });

  it('hides the percent when the minimum was applied', () => {
    expect(
      preflightDepositCopy({
        deposit_minimum_applied: true,
        deposit_percent: null,
      })
    ).toEqual({ minimumApplied: true, percent: null });
  });
});

describe('isMoMoDepositCheckoutPath', () => {
  it('shows deposit when the server quoted an amount', () => {
    expect(
      isMoMoDepositCheckoutPath({
        depositAmount: 150,
        preflightLoaded: true,
        payTiming: 'pay_at_pickup',
      })
    ).toBe(true);
  });

  it('hides deposit for cooked-food orders even before preflight', () => {
    expect(
      isMoMoDepositCheckoutPath({
        cookedFoodOrder: true,
        payTiming: 'pay_at_delivery',
        momoPayNowDeliveryEnabled: false,
      })
    ).toBe(false);
  });

  it('hides deposit for cooked-food pay-after alias', () => {
    expect(
      isMoMoDepositCheckoutPath({
        cookedFoodPayAfterConfirm: true,
        payTiming: 'pay_at_delivery',
        momoPayNowDeliveryEnabled: false,
      })
    ).toBe(false);
  });

  it('hides deposit when preflight loaded without a quote', () => {
    expect(
      isMoMoDepositCheckoutPath({
        preflightLoaded: true,
        payTiming: 'pay_at_pickup',
        momoPayNowDeliveryEnabled: false,
      })
    ).toBe(false);
  });

  it('does not invent a deposit before preflight', () => {
    expect(
      isMoMoDepositCheckoutPath({
        preflightLoaded: false,
        payTiming: 'pay_at_pickup',
        momoPayNowDeliveryEnabled: false,
      })
    ).toBe(false);
  });
});
