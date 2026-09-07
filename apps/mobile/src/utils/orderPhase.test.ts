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
  it('asks pay-at-pickup clients to pay in the app when ready', () => {
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
    expect(info.primaryActionId).toBe('pay');
  });

  it('tells the store to wait for the client to pay at pickup', () => {
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
    expect(info.primaryActionId).toBe('collect_pickup_payment');
  });

  it('lets the store request pickup payment after a failed attempt', () => {
    const info = resolveOrderPhase(
      {
        status: 'ready_for_pickup',
        fulfillmentMethod: 'pickup',
        paymentTiming: 'pay_at_pickup',
        paymentStatus: 'failed',
      },
      'business'
    );
    expect(info.primaryActionId).toBe('collect_pickup_payment');
  });

  it('keeps PIN-oriented copy for prepaid pickup', () => {
    const info = resolveOrderPhase(
      {
        status: 'ready_for_pickup',
        fulfillmentMethod: 'pickup',
        paymentTiming: 'pay_now',
        paymentStatus: 'authorized',
      },
      'client'
    );
    expect(info.nextStepKey).toBe('orders.nextStep.readyPickupClient');
  });
});
