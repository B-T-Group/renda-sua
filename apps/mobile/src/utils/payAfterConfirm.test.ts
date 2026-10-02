import { describe, expect, it } from 'vitest';
import { isCookedFoodOrderSnapshot } from './cookedFoodOrder';
import { orderToPhaseInput, resolveOrderPhase } from './orderPhase';
import {
  PAY_AFTER_GOODS_UNPAID_CANCEL_MINUTES,
  formatPayByTime,
  isUnpaidPayAfterOrder,
  payByUrgency,
  splitAroundTime,
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
    it('is null when paid, authorized, cooked, not pay-after, or not confirmed', () => {
      expect(payAfterPayByDeadline({ ...base, payment_status: 'paid' })).toBeNull();
      expect(payAfterPayByDeadline({ ...base, payment_status: 'authorized' })).toBeNull();
      expect(payAfterPayByDeadline({ ...base, order_items: [{ is_cooked_food: true }] })).toBeNull();
      expect(
        payAfterPayByDeadline({
          ...base,
          is_cooked_food_pickup: true,
          order_items: [{ is_cooked_food: false }],
        })
      ).toBeNull();
      expect(payAfterPayByDeadline({ ...base, pay_after_merchant_confirm: false })).toBeNull();
      expect(payAfterPayByDeadline({ ...base, current_status: 'pending' })).toBeNull();
      expect(payAfterPayByDeadline({ ...base, order_status_history: [] })).toBeNull();
    });

    it('uses the latest valid confirmed timestamp, not an earlier or invalid one', () => {
      const deadline = payAfterPayByDeadline({
        ...base,
        order_status_history: [
          { status: 'confirmed', created_at: '2026-10-01T09:00:00.000Z' },
          { status: 'confirmed', created_at: 'not-a-date' },
          { status: 'preparing', created_at: '2026-10-01T12:00:00.000Z' },
          { status: 'confirmed', created_at: '2026-10-01T11:00:00.000Z' },
        ],
      });
      expect(deadline?.getTime()).toBe(
        Date.parse('2026-10-01T11:00:00.000Z') + PAY_AFTER_GOODS_UNPAID_CANCEL_MINUTES * 60_000
      );
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

describe('payAfterConfirm pay-by helpers', () => {
  const deadline = new Date(2026, 9, 1, 14, 30); // local 14:30

  it('formats 24h in French and 12h in English, honouring the app language', () => {
    const now = new Date(2026, 9, 1, 13, 0);
    expect(formatPayByTime(deadline, 'fr', now)).toBe('14:30');
    expect(formatPayByTime(deadline, 'fr-CA', now)).toBe('14:30');
    expect(formatPayByTime(deadline, 'en', now)).toMatch(/^0?2:30\s?PM$/i);
  });

  it('prefixes tomorrow when the deadline is on a different day', () => {
    const lateNow = new Date(2026, 8, 30, 23, 50); // Sep 30
    expect(formatPayByTime(deadline, 'fr', lateNow, 'demain')).toBe('demain 14:30');
    expect(formatPayByTime(deadline, 'en', lateNow, 'tomorrow')).toMatch(/^tomorrow /);
  });

  it('classifies urgency: normal, urgent at <=10 min, expired at/after the deadline', () => {
    expect(payByUrgency(deadline, new Date(2026, 9, 1, 13, 0))).toBe('normal');
    expect(payByUrgency(deadline, new Date(2026, 9, 1, 14, 20))).toBe('urgent');
    expect(payByUrgency(deadline, new Date(2026, 9, 1, 14, 29))).toBe('urgent');
    expect(payByUrgency(deadline, new Date(2026, 9, 1, 14, 30))).toBe('expired');
    expect(payByUrgency(deadline, new Date(2026, 9, 1, 15, 0))).toBe('expired');
  });

  it('splits translated text around the time so it can be bolded', () => {
    expect(splitAroundTime('Pay by 14:30. Free.', '14:30')).toEqual({
      before: 'Pay by ',
      time: '14:30',
      after: '. Free.',
    });
    expect(splitAroundTime('No time here', '14:30')).toBeNull();
  });

  it('flags only unpaid pay-after orders for the free-cancel copy', () => {
    expect(
      isUnpaidPayAfterOrder({ pay_after_merchant_confirm: true, payment_status: 'pending' })
    ).toBe(true);
    expect(isUnpaidPayAfterOrder({ pay_after_merchant_confirm: true })).toBe(true);
    expect(
      isUnpaidPayAfterOrder({ pay_after_merchant_confirm: true, payment_status: 'paid' })
    ).toBe(false);
    expect(
      isUnpaidPayAfterOrder({ pay_after_merchant_confirm: true, payment_status: 'authorized' })
    ).toBe(false);
    expect(
      isUnpaidPayAfterOrder({ pay_after_merchant_confirm: false, payment_status: 'pending' })
    ).toBe(false);
  });
});
