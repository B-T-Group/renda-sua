import { describe, expect, it } from 'vitest';
import {
  orderProgressSteps,
  resolveOrderPhase,
} from './orderPhase';

describe('orderProgressSteps', () => {
  it('uses a short carrier shipping path', () => {
    expect(orderProgressSteps('shipping')).toEqual([
      'pending',
      'confirmed',
      'shipped',
      'complete',
    ]);
  });
});

describe('resolveOrderPhase shipping', () => {
  it('asks the merchant to mark confirmed shipping orders as shipped', () => {
    const info = resolveOrderPhase(
      { status: 'confirmed', fulfillmentMethod: 'shipping' },
      'business'
    );
    expect(info.phase).toBe('prepare');
    expect(info.primaryActionId).toBe('mark_shipped');
  });

  it('asks the client to confirm receipt after ship', () => {
    const info = resolveOrderPhase(
      { status: 'shipped', fulfillmentMethod: 'shipping' },
      'client'
    );
    expect(info.phase).toBe('in_delivery');
    expect(info.primaryActionId).toBe('confirm_receipt');
    expect(info.hubGroup).toBe('action_needed');
  });

  it('treats awaiting_shipment like confirmed', () => {
    const info = resolveOrderPhase(
      { status: 'awaiting_shipment', fulfillmentMethod: 'shipping' },
      'business'
    );
    expect(info.phase).toBe('prepare');
    expect(info.primaryActionId).toBe('mark_shipped');
  });

  it('hides agent claim actions for shipping orders', () => {
    const info = resolveOrderPhase(
      { status: 'confirmed', fulfillmentMethod: 'shipping' },
      'agent'
    );
    expect(info.primaryActionId).toBe('none');
  });
});

describe('resolveOrderPhase pickup ready', () => {
  it('asks pay-at-pickup clients to complete in the app when ready', () => {
    const info = resolveOrderPhase(
      {
        status: 'ready_for_pickup',
        fulfillmentMethod: 'pickup',
        paymentTiming: 'pay_at_pickup',
      },
      'client'
    );
    expect(info.nextStepKey).toBe(
      'orders.nextStep.readyPickupPayAtPickupClient'
    );
    expect(info.primaryActionId).toBe('complete');
  });

  it('tells the store to wait for the client to complete at pickup', () => {
    const info = resolveOrderPhase(
      {
        status: 'ready_for_pickup',
        fulfillmentMethod: 'pickup',
        paymentTiming: 'pay_at_pickup',
        paymentStatus: 'pending',
      },
      'business'
    );
    expect(info.nextStepKey).toBe(
      'orders.nextStep.readyPickupWaitClientPayBusiness'
    );
    expect(info.primaryActionId).toBe('none');
  });

  it('keeps the store waiting after a failed pay-at-pickup attempt', () => {
    const info = resolveOrderPhase(
      {
        status: 'ready_for_pickup',
        fulfillmentMethod: 'pickup',
        paymentTiming: 'pay_at_pickup',
        paymentStatus: 'failed',
      },
      'business'
    );
    expect(info.primaryActionId).toBe('none');
  });

  it('uses generic complete copy for prepaid non-cooked pickup', () => {
    const info = resolveOrderPhase(
      {
        status: 'ready_for_pickup',
        fulfillmentMethod: 'pickup',
        paymentTiming: 'pay_now',
        paymentStatus: 'authorized',
      },
      'client'
    );
    expect(info.nextStepKey).toBe(
      'orders.nextStep.readyPickupCompleteOrderClient'
    );
  });

  it('uses food complete copy for cooked-food pickup when ready', () => {
    const info = resolveOrderPhase(
      {
        status: 'ready_for_pickup',
        fulfillmentMethod: 'pickup',
        paymentTiming: 'pay_now',
        paymentStatus: 'authorized',
        isCookedFoodPickup: true,
      },
      'client'
    );
    expect(info.nextStepKey).toBe('orders.nextStep.readyPickupCompleteClient');
  });

  it('uses complete (not PIN) for cooked-food pickup when ready', () => {
    const info = resolveOrderPhase(
      {
        status: 'ready_for_pickup',
        fulfillmentMethod: 'pickup',
        paymentTiming: 'pay_now',
        paymentStatus: 'paid',
        isCookedFoodPickup: true,
      },
      'client'
    );
    expect(info.primaryActionId).toBe('complete');
  });

  it('hides mark ready while waiting for cooked-food payment', () => {
    const info = resolveOrderPhase(
      {
        status: 'confirmed',
        fulfillmentMethod: 'pickup',
        isCookedFoodPickup: true,
        payAfterMerchantConfirm: true,
        paymentStatus: 'pending',
      },
      'business'
    );
    expect(info.primaryActionId).toBe('none');
    expect(info.nextStepKey).toBe('orders.nextStep.cookedFoodWaitPaymentBusiness');
  });
});
