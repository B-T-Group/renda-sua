import { describe, expect, it } from 'vitest';
import { resolveOrderNextSteps } from './orderPlacedNextSteps';

const base = {
  orderNumbers: ['1001'],
  paymentTiming: 'pay_at_pickup' as const,
  isStripeRail: false,
};

describe('resolveOrderNextSteps', () => {
  it('lists kitchen confirm, payment, prep, and pickup for cooked food', () => {
    const steps = resolveOrderNextSteps({
      ...base,
      cookedFoodPayAfterConfirm: true,
      fulfillment: 'pickup',
    });
    expect(steps?.steps.map((step) => step.id)).toEqual([
      'confirm',
      'pay',
      'prep',
      'ready',
      'done',
    ]);
  });

  it('tells a pay-at-pickup shopper to tap Pay now when the order is ready', () => {
    const steps = resolveOrderNextSteps({ ...base, fulfillment: 'pickup' });
    expect(steps?.steps.map((step) => step.id)).toEqual(['prep', 'ready', 'pay', 'done']);
  });

  it('asks for the remaining amount at pickup after a deposit', () => {
    const steps = resolveOrderNextSteps({
      ...base,
      depositConfirmed: true,
      remainingAmountLabel: '1,500 XAF',
      fulfillment: 'pickup',
    });
    expect(steps?.steps[2]?.values).toEqual({ amount: '1,500 XAF' });
  });

  it('keeps cooked-food delivery free of a door payment', () => {
    const steps = resolveOrderNextSteps({
      ...base,
      paymentTiming: 'pay_now',
      cookedFoodPayAfterConfirm: true,
      fulfillment: 'delivery',
    });
    expect(steps?.steps.map((step) => step.id)).toEqual([
      'confirm',
      'pay',
      'prep',
      'ready',
      'done',
    ]);
    expect(steps?.steps[4]?.key).toContain('foodOnTheWay');
  });
});
