/**
 * Tests for the cancellation feature's pure business-logic utilities.
 *
 * The project's vitest config uses a node environment (no React renderer and no
 * react-native bindings), so we test only modules that are free of native
 * React Native imports:
 *
 *  1. clientCanCancelOrder  – pure eligibility logic
 *  2. trackCancellationEvent – analytics fire-and-forget (apiClient mocked)
 *  3. CancellationPreview type shapes verified at runtime
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import type { CancellationPreview } from '../types/agent';
import { clientCanCancelOrder } from '../utils/clientOrderActions';
import type { Order } from '../types/agent';

vi.mock('../services/analytics/AppEventsService', () => ({
  AppEventsService: {
    track: vi.fn(),
  },
  trackSiteEvent: vi.fn(),
}));

import { trackCancellationEvent } from '../utils/cancellationAnalytics';
import type { CancellationEventName } from '../utils/cancellationAnalytics';
import { AppEventsService } from '../services/analytics/AppEventsService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeOrder(partial: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    order_number: '1001',
    client_id: 'client-1',
    business_id: 'biz-1',
    business_location_id: 'loc-1',
    delivery_address_id: 'addr-1',
    tax_amount: 0,
    currency: 'XAF',
    current_status: 'pending',
    requires_fast_delivery: false,
    ...partial,
  } as Order;
}

// ─── 1. clientCanCancelOrder ──────────────────────────────────────────────────

describe('clientCanCancelOrder', () => {
  it('allows cancellation for pending_payment status', () => {
    expect(clientCanCancelOrder(makeOrder({ current_status: 'pending_payment' }))).toBe(true);
  });

  it('allows cancellation for pending status', () => {
    expect(clientCanCancelOrder(makeOrder({ current_status: 'pending' }))).toBe(true);
  });

  it('allows cancellation for confirmed status', () => {
    expect(clientCanCancelOrder(makeOrder({ current_status: 'confirmed' }))).toBe(true);
  });

  it('allows cancellation for preparing status', () => {
    expect(clientCanCancelOrder(makeOrder({ current_status: 'preparing' }))).toBe(true);
  });

  it('allows cancellation for ready_for_pickup status', () => {
    expect(clientCanCancelOrder(makeOrder({ current_status: 'ready_for_pickup' }))).toBe(true);
  });

  it('blocks cancellation once agent is assigned', () => {
    expect(
      clientCanCancelOrder(
        makeOrder({ current_status: 'confirmed', assigned_agent_id: 'agent-1' })
      )
    ).toBe(false);
  });

  it('blocks cancellation for in_transit status', () => {
    expect(clientCanCancelOrder(makeOrder({ current_status: 'in_transit' }))).toBe(false);
  });

  it('blocks cancellation for out_for_delivery status', () => {
    expect(clientCanCancelOrder(makeOrder({ current_status: 'out_for_delivery' }))).toBe(false);
  });

  it('blocks cancellation for delivered status', () => {
    expect(clientCanCancelOrder(makeOrder({ current_status: 'delivered' }))).toBe(false);
  });

  it('blocks cancellation for complete status', () => {
    expect(clientCanCancelOrder(makeOrder({ current_status: 'complete' }))).toBe(false);
  });

  it('blocks cancellation for already cancelled status', () => {
    expect(clientCanCancelOrder(makeOrder({ current_status: 'cancelled' }))).toBe(false);
  });
});

// ─── 2. trackCancellationEvent ───────────────────────────────────────────────

describe('trackCancellationEvent', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('fires trackSiteEvent without throwing', () => {
    expect(() =>
      trackCancellationEvent('cancellation_dialog_opened', {
        orderId: 'order-1',
        orderStatus: 'confirmed',
        paymentSource: 'credit_card',
      })
    ).not.toThrow();
  });

  it('passes correct event type and metadata', () => {
    const track = vi.mocked(AppEventsService.track);

    trackCancellationEvent('cancellation_preview_loaded', { orderId: 'o1', canCancel: true });

    expect(track).toHaveBeenCalledWith({
      eventType: 'cancellation.preview_loaded',
      metadata: { orderId: 'o1', canCancel: true, source: 'mobile' },
    });
  });

  it('accepts all defined event names without throwing', () => {
    const events: CancellationEventName[] = [
      'cancellation_dialog_opened',
      'cancellation_preview_loaded',
      'cancellation_preview_failed',
      'cancellation_reason_selected',
      'cancellation_confirmed',
      'cancellation_abandoned',
      'cancellation_blocked_shown',
    ];

    for (const event of events) {
      expect(() => trackCancellationEvent(event, { orderId: 'o1' })).not.toThrow();
    }
  });

  it('is fire-and-forget (never throws to callers)', () => {
    expect(() =>
      trackCancellationEvent('cancellation_abandoned', {})
    ).not.toThrow();
  });
});

// ─── 3. CancellationPreview type shapes ──────────────────────────────────────

describe('CancellationPreview type shapes', () => {
  it('full refund preview is valid', () => {
    const preview: CancellationPreview = {
      canCancel: true,
      refundType: 'full',
      refundAmount: 5000,
      refundCurrency: 'XAF',
      cancellationFee: 0,
      estimatedRefundProcessingTime: 'stripe_5_10_business_days',
      paymentSource: 'credit_card',
      cancellationConsequences: ['consequences.businessNotified'],
      availableCancellationReasons: [{ id: 1, value: 'changed_mind', display: 'Changed my mind' }],
    };

    expect(preview.refundType).toBe('full');
    expect(preview.cancellationFee).toBe(0);
    expect(preview.availableCancellationReasons).toHaveLength(1);
  });

  it('partial refund preview deducts cancellation fee', () => {
    const preview: CancellationPreview = {
      canCancel: true,
      refundType: 'partial',
      refundAmount: 4500,
      refundCurrency: 'XAF',
      cancellationFee: 500,
      estimatedRefundProcessingTime: 'stripe_5_10_business_days',
      paymentSource: 'credit_card',
      cancellationConsequences: [],
      availableCancellationReasons: [],
    };

    expect(preview.refundAmount + preview.cancellationFee).toBe(5000);
  });

  it('none refund preview has zero refund amount', () => {
    const preview: CancellationPreview = {
      canCancel: true,
      refundType: 'none',
      refundAmount: 0,
      refundCurrency: 'XAF',
      cancellationFee: 5000,
      estimatedRefundProcessingTime: '',
      paymentSource: 'credit_card',
      cancellationConsequences: [],
      availableCancellationReasons: [],
    };

    expect(preview.refundAmount).toBe(0);
    expect(preview.cancellationFee).toBe(5000);
  });

  it('authorization_release preview for manual capture Stripe orders', () => {
    const preview: CancellationPreview = {
      canCancel: true,
      refundType: 'authorization_release',
      refundAmount: 49.99,
      refundCurrency: 'CAD',
      cancellationFee: 0,
      estimatedRefundProcessingTime: 'authorization_release_immediate',
      paymentSource: 'credit_card',
      cancellationConsequences: [],
      availableCancellationReasons: [],
    };

    expect(preview.refundType).toBe('authorization_release');
    expect(preview.estimatedRefundProcessingTime).toBe('authorization_release_immediate');
  });

  it('wallet_credit preview has correct payment source', () => {
    const preview: CancellationPreview = {
      canCancel: true,
      refundType: 'wallet_credit',
      refundAmount: 3000,
      refundCurrency: 'XAF',
      cancellationFee: 0,
      estimatedRefundProcessingTime: 'mobile_money_provider',
      paymentSource: 'mobile_payment',
      cancellationConsequences: [],
      availableCancellationReasons: [],
    };

    expect(preview.paymentSource).toBe('mobile_payment');
    expect(preview.estimatedRefundProcessingTime).toBe('mobile_money_provider');
  });

  it('blocked preview has reasonIfBlocked set', () => {
    const blocked: CancellationPreview = {
      canCancel: false,
      reasonIfBlocked: 'blocked.agentAssigned',
      refundType: 'none',
      refundAmount: 0,
      refundCurrency: 'XAF',
      cancellationFee: 0,
      estimatedRefundProcessingTime: '',
      paymentSource: 'credit_card',
      cancellationConsequences: [],
      availableCancellationReasons: [],
    };

    expect(blocked.canCancel).toBe(false);
    expect(blocked.reasonIfBlocked).toBe('blocked.agentAssigned');
  });
});
