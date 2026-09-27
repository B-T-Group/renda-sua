import { orderToPhaseInput, resolveOrderPhase } from './orderPhase';

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
