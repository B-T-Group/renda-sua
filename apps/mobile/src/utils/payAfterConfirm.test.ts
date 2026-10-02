import { describe, expect, it } from 'vitest';
import { isCookedFoodOrderSnapshot } from './cookedFoodOrder';
import { orderToPhaseInput, resolveOrderPhase } from './orderPhase';
import {
  PAY_AFTER_GOODS_UNPAID_CANCEL_MINUTES,
  payAfterCopyVariantForPreflight,
  payAfterPayByDeadline,
  resolveCreatedPayAfter,
} from './payAfterConfirm';

describe('payAfterConfirm utils', () => {
  it('uses kitchen wording only when every group is cooked food', () => {
    expect(
      payAfterCopyVariantForPreflight({ groups: [{ business_id: 'a', all_cooked_food: true }] } as any)
    ).toBe('cooked');
    expect(
      payAfterCopyVariantForPreflight({
        groups: [
          { business_id: 'a', all_cooked_food: true },
          { business_id: 'b', all_cooked_food: false },
        ],
      } as any)
    ).toBe('store');
    expect(payAfterCopyVariantForPreflight(null)).toBe('store');
  });

  it('navigates on the create response, not the preflight', () => {
    expect(resolveCreatedPayAfter([{ pay_after_merchant_confirm: true }])).toBe(true);
    expect(resolveCreatedPayAfter([{}, { pay_after_merchant_confirm: false }])).toBe(false);
    expect(resolveCreatedPayAfter([])).toBe(false);
  });

  it('classifies cooked vs goods by line snapshot', () => {
    expect(
      isCookedFoodOrderSnapshot({
        pay_after_merchant_confirm: true,
        order_items: [{ is_cooked_food: false }],
      } as any)
    ).toBe(false);
    expect(
      isCookedFoodOrderSnapshot({
        pay_after_merchant_confirm: true,
        order_items: [{ is_cooked_food: true }],
      } as any)
    ).toBe(true);
    expect(isCookedFoodOrderSnapshot({ pay_after_merchant_confirm: true } as any)).toBe(true);
  });

  describe('payAfterPayByDeadline', () => {
    const base: any = {
      pay_after_merchant_confirm: true,
      current_status: 'confirmed',
      payment_status: 'pending',
      order_items: [{ is_cooked_food: false }],
      order_status_history: [
        { status: 'pending', created_at: '2026-10-01T10:00:00.000Z' },
        { status: 'confirmed', created_at: '2026-10-01T10:05:00.000Z' },
      ],
    };
    it('is confirm time + 45 min for unpaid goods', () => {
      expect(payAfterPayByDeadline(base)?.getTime()).toBe(
        Date.parse('2026-10-01T10:05:00.000Z') + PAY_AFTER_GOODS_UNPAID_CANCEL_MINUTES * 60_000
      );
    });
    it('is null when paid, cooked, not pay-after or not confirmed', () => {
      expect(payAfterPayByDeadline({ ...base, payment_status: 'paid' })).toBeNull();
      expect(payAfterPayByDeadline({ ...base, order_items: [{ is_cooked_food: true }] })).toBeNull();
      expect(payAfterPayByDeadline({ ...base, pay_after_merchant_confirm: false })).toBeNull();
      expect(payAfterPayByDeadline({ ...base, current_status: 'pending' })).toBeNull();
    });
  });
});

describe('orderPhase store wording for non-cooked pay-after', () => {
  const goods: any = {
    fulfillment_method: 'delivery',
    fulfillment_timing: 'asap',
    current_status: 'confirmed',
    pay_after_merchant_confirm: true,
    payment_status: 'pending',
    order_items: [{ is_cooked_food: false }],
  };
  it('asks the client to pay with generic store copy', () => {
    const info = resolveOrderPhase(orderToPhaseInput(goods), 'client');
    expect(info.primaryActionId).toBe('pay');
    expect(info.nextStepKey).toBe('orders.nextStep.payAfterWaitPaymentClient');
  });
  it('business waits, then marks ready once paid', () => {
    expect(resolveOrderPhase(orderToPhaseInput(goods), 'business').nextStepKey).toBe(
      'orders.nextStep.payAfterWaitPaymentBusiness'
    );
    const paid = resolveOrderPhase(orderToPhaseInput({ ...goods, payment_status: 'paid' }), 'business');
    expect(paid.nextStepKey).toBe('orders.nextStep.payAfterPaidMarkReadyBusiness');
    expect(paid.primaryActionId).toBe('mark_ready');
  });
  it('keeps kitchen wording for cooked food', () => {
    const info = resolveOrderPhase(
      orderToPhaseInput({ ...goods, order_items: [{ is_cooked_food: true }] }),
      'client'
    );
    expect(info.nextStepKey).toBe('orders.nextStep.cookedFoodWaitPaymentClient');
  });
});
