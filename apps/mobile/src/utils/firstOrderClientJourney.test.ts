import { beforeEach, describe, expect, it } from 'vitest';
import { persistFirstOrderGuidanceForced } from '../config/firstOrderDebug';
import {
  getClientFirstOrderPreviewSteps,
  isClientFirstOrderCheckoutEligible,
  isClientFirstOrderWaveEligible,
  resolveClientFirstOrderJourney,
  resolveClientFirstOrderStepId,
} from './firstOrderClientJourney';

describe('firstOrderClientJourney', () => {
  beforeEach(async () => {
    await persistFirstOrderGuidanceForced(false);
  });

  it('hides the journey when client orders are unknown', () => {
    const view = resolveClientFirstOrderJourney({
      order: { id: 'o1', current_status: 'pending', fulfillment_method: 'delivery' },
      clientOrders: null,
    });
    expect(view.showJourney).toBe(false);
  });

  it('shows the journey for a first order', () => {
    const view = resolveClientFirstOrderJourney({
      order: {
        id: 'o1',
        current_status: 'pending',
        fulfillment_method: 'delivery',
        created_at: '2026-09-03T12:00:00.000Z',
      },
      clientOrders: [
        {
          current_status: 'pending',
          created_at: '2026-09-03T12:00:00.000Z',
        },
      ],
    });
    expect(view.showJourney).toBe(true);
    expect(view.currentStepId).toBe('order_received');
    expect(view.steps[0]?.state).toBe('current');
    expect(view.fulfillmentPath).toBe('delivery');
  });

  it('shows the journey for a multi-business first checkout wave', () => {
    const clientOrders = [
      { current_status: 'pending', created_at: '2026-09-03T12:00:00.000Z' },
      { current_status: 'pending', created_at: '2026-09-03T12:00:30.000Z' },
      { current_status: 'pending', created_at: '2026-09-03T12:01:00.000Z' },
    ];
    expect(isClientFirstOrderWaveEligible(clientOrders)).toBe(true);
    const view = resolveClientFirstOrderJourney({
      order: {
        id: 'o1',
        current_status: 'pending',
        fulfillment_method: 'delivery',
        created_at: '2026-09-03T12:00:00.000Z',
      },
      clientOrders,
    });
    expect(view.showJourney).toBe(true);
  });

  it('ignores older cancelled history when checking the active wave', () => {
    const orders = [
      { current_status: 'cancelled', created_at: '2026-08-01T12:00:00.000Z' },
      { current_status: 'pending', created_at: '2026-09-03T12:00:00.000Z' },
    ];
    expect(isClientFirstOrderWaveEligible(orders)).toBe(true);
  });

  it('hides the journey after a later second purchase', () => {
    const orders = [
      { current_status: 'pending', created_at: '2026-09-03T12:00:00.000Z' },
      { current_status: 'pending', created_at: '2026-09-03T13:00:00.000Z' },
    ];
    expect(isClientFirstOrderWaveEligible(orders)).toBe(false);
    const view = resolveClientFirstOrderJourney({
      order: {
        id: 'o2',
        current_status: 'pending',
        fulfillment_method: 'delivery',
        created_at: '2026-09-03T13:00:00.000Z',
      },
      clientOrders: orders,
    });
    expect(view.showJourney).toBe(false);
  });

  it('forces the journey when debug is on', async () => {
    await persistFirstOrderGuidanceForced(true);
    const view = resolveClientFirstOrderJourney({
      order: { id: 'old', current_status: 'complete', fulfillment_method: 'delivery' },
      clientOrders: [
        { current_status: 'complete', created_at: '2026-01-01T00:00:00.000Z' },
        { current_status: 'pending', created_at: '2026-09-03T12:00:00.000Z' },
      ],
    });
    expect(view.showJourney).toBe(true);
    expect(view.isDebugForced).toBe(true);
    expect(view.isSuccess).toBe(true);
  });

  it('maps pending_payment to its own step', () => {
    const view = resolveClientFirstOrderJourney({
      order: {
        id: 'o1',
        current_status: 'pending_payment',
        fulfillment_method: 'delivery',
        created_at: '2026-09-03T12:00:00.000Z',
      },
      clientOrders: [
        { current_status: 'pending_payment', created_at: '2026-09-03T12:00:00.000Z' },
      ],
    });
    expect(view.currentStepId).toBe('pending_payment');
    expect(view.steps[0]?.id).toBe('pending_payment');
    expect(view.steps[0]?.state).toBe('current');
    expect(view.steps[1]?.id).toBe('order_received');
  });

  it('advances delivery steps by status', () => {
    const confirmed = resolveClientFirstOrderStepId(
      { id: 'o1', current_status: 'confirmed', fulfillment_method: 'delivery' },
      'delivery'
    );
    const preparing = resolveClientFirstOrderStepId(
      { id: 'o1', current_status: 'preparing', fulfillment_method: 'delivery' },
      'delivery'
    );
    const ready = resolveClientFirstOrderStepId(
      { id: 'o1', current_status: 'ready_for_pickup', fulfillment_method: 'delivery' },
      'delivery'
    );
    const transit = resolveClientFirstOrderStepId(
      { id: 'o1', current_status: 'out_for_delivery', fulfillment_method: 'delivery' },
      'delivery'
    );
    expect(confirmed).toBe('confirmed');
    expect(preparing).toBe('preparing');
    expect(ready).toBe('courier_assigned');
    expect(transit).toBe('on_the_way');
  });

  it('uses pickup-specific steps and PIN explainer', () => {
    const view = resolveClientFirstOrderJourney({
      order: {
        id: 'o1',
        current_status: 'ready_for_pickup',
        fulfillment_method: 'pickup',
        payment_timing: 'pay_now',
        payment_status: 'paid',
        created_at: '2026-09-03T12:00:00.000Z',
      },
      clientOrders: [
        { current_status: 'ready_for_pickup', created_at: '2026-09-03T12:00:00.000Z' },
      ],
    });
    expect(view.fulfillmentPath).toBe('pickup');
    expect(view.currentStepId).toBe('ready_for_pickup');
    expect(view.pinExplainerKey).toBe('client.firstOrder.pinExplainerPickup');
    expect(view.pinExplainerDefault).toMatch(/merchant is paid only/i);
    expect(view.steps.some((step) => step.id === 'courier_assigned')).toBe(false);
  });

  it('omits pickup PIN explainer for pay-at-pickup', () => {
    const view = resolveClientFirstOrderJourney({
      order: {
        id: 'o1',
        current_status: 'ready_for_pickup',
        fulfillment_method: 'pickup',
        payment_timing: 'pay_at_pickup',
        created_at: '2026-09-03T12:00:00.000Z',
      },
      clientOrders: [
        { current_status: 'ready_for_pickup', created_at: '2026-09-03T12:00:00.000Z' },
      ],
    });
    expect(view.pinExplainerKey).toBeNull();
    const readyStep = view.steps.find((step) => step.id === 'ready_for_pickup');
    expect(readyStep?.whatHappensKey).toBe(
      'client.firstOrder.steps.readyForPickup.whatHappensPayAtPickup'
    );
    expect(readyStep?.whatHappensDefault).toMatch(/tap Pay/i);
  });

  it('uses shipping-specific steps', () => {
    const view = resolveClientFirstOrderJourney({
      order: {
        id: 'o1',
        current_status: 'shipped',
        fulfillment_method: 'shipping',
        created_at: '2026-09-03T12:00:00.000Z',
      },
      clientOrders: [{ current_status: 'shipped', created_at: '2026-09-03T12:00:00.000Z' }],
    });
    expect(view.currentStepId).toBe('shipped');
    expect(view.fulfillmentPath).toBe('shipping');
  });

  it('shows a delivery PIN explainer on the way', () => {
    const view = resolveClientFirstOrderJourney({
      order: {
        id: 'o1',
        current_status: 'out_for_delivery',
        fulfillment_method: 'delivery',
        payment_timing: 'pay_now',
        created_at: '2026-09-03T12:00:00.000Z',
      },
      clientOrders: [
        { current_status: 'out_for_delivery', created_at: '2026-09-03T12:00:00.000Z' },
      ],
    });
    expect(view.pinExplainerKey).toBe('client.firstOrder.pinExplainerDelivery');
  });

  it('maps success statuses to the path end step', () => {
    const delivery = resolveClientFirstOrderJourney({
      order: {
        id: 'o1',
        current_status: 'delivered',
        fulfillment_method: 'delivery',
        created_at: '2026-09-03T12:00:00.000Z',
      },
      clientOrders: [{ current_status: 'delivered', created_at: '2026-09-03T12:00:00.000Z' }],
    });
    const pickup = resolveClientFirstOrderJourney({
      order: {
        id: 'o1',
        current_status: 'complete',
        fulfillment_method: 'pickup',
        created_at: '2026-09-03T12:00:00.000Z',
      },
      clientOrders: [{ current_status: 'complete', created_at: '2026-09-03T12:00:00.000Z' }],
    });
    expect(delivery.isSuccess).toBe(true);
    expect(delivery.currentStepId).toBe('delivered');
    expect(pickup.currentStepId).toBe('picked_up');
  });

  it('maps cancelled orders to a cancelled step', () => {
    const view = resolveClientFirstOrderJourney({
      order: {
        id: 'o1',
        current_status: 'cancelled',
        fulfillment_method: 'delivery',
        created_at: '2026-09-03T12:00:00.000Z',
      },
      clientOrders: [{ current_status: 'cancelled', created_at: '2026-09-03T12:00:00.000Z' }],
    });
    expect(view.isTerminal).toBe(true);
    expect(view.isSuccess).toBe(false);
    expect(view.currentStepId).toBe('cancelled');
    expect(view.steps).toHaveLength(1);
    expect(view.showJourney).toBe(true);
  });

  it('treats a multi-order checkout as first purchase on success screen', () => {
    expect(isClientFirstOrderCheckoutEligible(3, 3)).toBe(true);
    expect(isClientFirstOrderCheckoutEligible(1, 1)).toBe(true);
    expect(isClientFirstOrderCheckoutEligible(4, 1)).toBe(false);
  });

  it('builds a preview with the first step current', () => {
    const steps = getClientFirstOrderPreviewSteps('delivery');
    expect(steps[0]?.id).toBe('order_received');
    expect(steps[0]?.state).toBe('current');
    expect(steps[1]?.state).toBe('upcoming');
    expect(steps.map((step) => step.id)).toEqual([
      'order_received',
      'confirmed',
      'preparing',
      'courier_assigned',
      'on_the_way',
      'delivered',
    ]);
  });
});
