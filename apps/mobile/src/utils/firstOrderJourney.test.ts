import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FIRST_ORDER_ONBOARDING_NUDGE_ID,
  getFirstOrderFulfillmentPath,
  isFirstOrderTerminalStatus,
  resolveFirstOrderJourney,
  shouldShowFirstOrderOverlayGuidance,
} from './firstOrderJourney';
import {
  getCachedFirstOrderPins,
  pinFirstOrder,
  resetAllFirstOrderPins,
} from './firstOrderJourneyStorage';
import {
  isFirstOrderGuidanceForced,
  persistFirstOrderGuidanceForced,
} from '../config/firstOrderDebug';

vi.mock('../services/storage/StorageService', () => ({
  default: {
    getObject: vi.fn(async () => ({})),
    setObject: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
  },
}));

describe('firstOrderJourney', () => {
  beforeEach(async () => {
    await resetAllFirstOrderPins();
    await persistFirstOrderGuidanceForced(false);
  });

  it('detects fulfillment paths', () => {
    expect(getFirstOrderFulfillmentPath({ fulfillment_method: 'delivery' })).toBe(
      'delivery'
    );
    expect(getFirstOrderFulfillmentPath({ fulfillment_method: 'pickup' })).toBe(
      'pickup'
    );
    expect(getFirstOrderFulfillmentPath({ fulfillment_method: 'shipping' })).toBe(
      'shipping'
    );
  });

  it('shows journey for eligible first order and requests pin', () => {
    const view = resolveFirstOrderJourney({
      order: { id: 'o1', current_status: 'pending', fulfillment_method: 'delivery' },
      businessId: 'b1',
      ordersTotal: 1,
      isLegacyNudgeConverted: false,
    });
    expect(view.showJourney).toBe(true);
    expect(view.shouldPin).toBe(true);
    expect(view.currentStepId).toBe('review_confirm');
    expect(view.steps[0]?.state).toBe('current');
  });

  it('does not show when legacy onboarding was converted and ordersTotal > 1', () => {
    const view = resolveFirstOrderJourney({
      order: { id: 'o2', current_status: 'pending', fulfillment_method: 'delivery' },
      businessId: 'b1',
      ordersTotal: 5,
      isLegacyNudgeConverted: true,
    });
    expect(view.showJourney).toBe(false);
    expect(view.shouldPin).toBe(false);
  });

  it('shows only on the pinned order when another pin exists', async () => {
    await pinFirstOrder('b1', 'pinned-order');
    const pinned = resolveFirstOrderJourney({
      order: { id: 'pinned-order', current_status: 'confirmed', fulfillment_method: 'delivery' },
      businessId: 'b1',
      ordersTotal: 3,
    });
    const other = resolveFirstOrderJourney({
      order: { id: 'other-order', current_status: 'pending', fulfillment_method: 'delivery' },
      businessId: 'b1',
      ordersTotal: 3,
    });
    expect(pinned.showJourney).toBe(true);
    expect(pinned.isPinned).toBe(true);
    expect(other.showJourney).toBe(false);
    expect(getCachedFirstOrderPins().b1?.orderId).toBe('pinned-order');
  });

  it('advances delivery steps by status', () => {
    const ready = resolveFirstOrderJourney({
      order: {
        id: 'o1',
        current_status: 'ready_for_pickup',
        fulfillment_method: 'delivery',
      },
      businessId: 'b1',
      ordersTotal: 1,
    });
    expect(ready.currentStepId).toBe('find_courier');

    const assigned = resolveFirstOrderJourney({
      order: {
        id: 'o1',
        current_status: 'assigned_to_agent',
        fulfillment_method: 'delivery',
        assigned_agent_id: 'agent-1',
      },
      businessId: 'b1',
      ordersTotal: 1,
    });
    expect(assigned.currentStepId).toBe('hand_over');
  });

  it('uses pickup-specific steps', () => {
    const view = resolveFirstOrderJourney({
      order: {
        id: 'o1',
        current_status: 'ready_for_pickup',
        fulfillment_method: 'pickup',
        payment_timing: 'pay_now',
        payment_status: 'paid',
      },
      businessId: 'b1',
      ordersTotal: 1,
    });
    expect(view.currentStepId).toBe('ready_collect');
    expect(view.steps.some((step) => step.id === 'find_courier')).toBe(false);
  });

  it('uses collect_pickup when pay-at-pickup payment is pending', () => {
    const view = resolveFirstOrderJourney({
      order: {
        id: 'o1',
        current_status: 'ready_for_pickup',
        fulfillment_method: 'pickup',
        payment_timing: 'pay_at_pickup',
        payment_status: 'pending',
      },
      businessId: 'b1',
      ordersTotal: 1,
    });
    expect(view.currentStepId).toBe('collect_pickup');
  });

  it('marks terminal statuses', () => {
    expect(isFirstOrderTerminalStatus('complete')).toBe(true);
    expect(isFirstOrderTerminalStatus('delivered')).toBe(true);
    expect(isFirstOrderTerminalStatus('cancelled')).toBe(true);
    expect(isFirstOrderTerminalStatus('pending')).toBe(false);
  });

  it('forces guidance on any order when debug flag is on', async () => {
    await persistFirstOrderGuidanceForced(true);
    const view = resolveFirstOrderJourney({
      order: { id: 'old', current_status: 'complete', fulfillment_method: 'delivery' },
      businessId: 'b9',
      ordersTotal: 99,
      isLegacyNudgeConverted: true,
      isDebugForced: isFirstOrderGuidanceForced(),
    });
    expect(view.showJourney).toBe(true);
    expect(view.shouldPin).toBe(false);
    expect(view.isDebugForced).toBe(true);
  });

  it('overlay guidance respects pin and eligibility', async () => {
    expect(
      shouldShowFirstOrderOverlayGuidance({
        orderId: 'o1',
        businessId: 'b1',
        ordersTotal: 1,
        isLegacyNudgeConverted: false,
      })
    ).toBe(true);

    await pinFirstOrder('b1', 'o-pinned');
    expect(
      shouldShowFirstOrderOverlayGuidance({
        orderId: 'o-other',
        businessId: 'b1',
        ordersTotal: 2,
      })
    ).toBe(false);
  });

  it('does not pin or show when ordersTotal is unknown', () => {
    const view = resolveFirstOrderJourney({
      order: { id: 'o1', current_status: 'pending', fulfillment_method: 'delivery' },
      businessId: 'b1',
      ordersTotal: undefined,
      isLegacyNudgeConverted: false,
    });
    expect(view.showJourney).toBe(false);
    expect(view.shouldPin).toBe(false);
  });

  it('overlay guidance waits for known ordersTotal', () => {
    expect(
      shouldShowFirstOrderOverlayGuidance({
        orderId: 'o1',
        businessId: 'b1',
        ordersTotal: undefined,
        isLegacyNudgeConverted: false,
      })
    ).toBe(false);
  });

  it('exports legacy nudge id for migration', () => {
    expect(FIRST_ORDER_ONBOARDING_NUDGE_ID).toBe('first-order-onboarding');
  });
});
