import {
  clientJourneyActiveIndex,
  clientJourneyMessage,
  clientJourneySteps,
  isClientJourneyPickup,
  orderToPhaseInput,
  resolveOrderPhase,
} from './orderPhase';

describe('clientJourneySteps', () => {
  it('uses picked up instead of delivered for pickup orders', () => {
    expect(
      isClientJourneyPickup({
        fulfillmentMethod: 'pickup',
        paymentTiming: 'pay_now',
      })
    ).toBe(true);
    expect(clientJourneySteps(true)).toEqual([
      'placed',
      'confirmed',
      'preparing',
      'picked_up',
    ]);
    expect(clientJourneyActiveIndex('done', 4)).toBe(3);
    expect(clientJourneyMessage('done', true).fallback).toBe(
      'Your order was picked up.'
    );
  });

  it('keeps on the way for delivery orders', () => {
    expect(isClientJourneyPickup({ fulfillmentMethod: 'delivery' })).toBe(false);
    expect(clientJourneySteps(false)).toContain('on_the_way');
    expect(clientJourneyMessage('done', false).key).toBe(
      'client.journey.messageDelivered'
    );
  });
});

describe('orderToPhaseInput cooked-food pickup', () => {
  it('infers cooked-food pickup from line flags when the order flag is missing', () => {
    const input = orderToPhaseInput({
      fulfillment_method: 'pickup',
      fulfillment_timing: 'asap',
      current_status: 'confirmed',
      pay_after_merchant_confirm: true,
      payment_status: 'pending',
      order_items: [{ is_cooked_food: true }],
    });
    expect(input.isCookedFoodPickup).toBe(true);
    const info = resolveOrderPhase(input, 'business');
    expect(info.primaryActionId).toBe('none');
    expect(info.hubGroup).toBe('waiting');
    expect(info.nextStepKey).toBe(
      'orders.nextStep.cookedFoodWaitPaymentBusiness'
    );
  });

  it('does not infer cooked-food pickup for delivery', () => {
    const input = orderToPhaseInput({
      fulfillment_method: 'delivery',
      fulfillment_timing: 'asap',
      current_status: 'confirmed',
      order_items: [{ item: { is_cooked_food: true } }],
    });
    expect(input.isCookedFoodPickup).toBe(false);
    expect(resolveOrderPhase(input, 'business').primaryActionId).toBe(
      'mark_ready'
    );
  });

  it('asks the client to pay while the kitchen waits', () => {
    const info = resolveOrderPhase(
      {
        status: 'confirmed',
        fulfillmentMethod: 'pickup',
        isCookedFoodPickup: true,
        payAfterMerchantConfirm: true,
        paymentStatus: 'pending',
      },
      'client'
    );
    expect(info.primaryActionId).toBe('pay');
    expect(info.nextStepKey).toBe('orders.nextStep.cookedFoodWaitPaymentClient');
    expect(info.hubGroup).toBe('waiting');
  });
});
