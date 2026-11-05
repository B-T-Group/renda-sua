import { describe, expect, it } from 'vitest';
import { rankOrderDetailActions } from './rankOrderDetailActions';
import { rankBusinessOrderDetailActions } from './rankBusinessOrderDetailActions';
import { rankAgentOrderDetailActions } from './rankAgentOrderDetailActions';
import { rankClientOrderDetailActions } from './rankClientOrderDetailActions';
import type { BusinessOrder } from '../types/business/orders';
import type { Order } from '../types/agent';

function biz(partial: Partial<BusinessOrder>): BusinessOrder {
  return {
    id: '1',
    order_number: '100',
    current_status: 'pending',
    currency: 'XAF',
    ...partial,
  } as BusinessOrder;
}

function client(partial: Partial<Order>): Order {
  return {
    id: '1',
    order_number: '100',
    client_id: 'c',
    business_id: 'b',
    business_location_id: 'l',
    delivery_address_id: 'a',
    tax_amount: 0,
    currency: 'XAF',
    current_status: 'pending',
    requires_fast_delivery: false,
    ...partial,
  } as Order;
}

describe('rankOrderDetailActions', () => {
  it('returns empty when there are no actions', () => {
    expect(rankOrderDetailActions([])).toEqual({
      primary: null,
      companion: null,
      overflow: [],
    });
  });

  it('promotes cancel to companion and leaves the rest in overflow', () => {
    const ranked = rankOrderDetailActions(
      [
        { id: 'confirm', labelKey: 'a', defaultLabel: 'Confirm', preferred: true },
        { id: 'cancel', labelKey: 'b', defaultLabel: 'Cancel', destructive: true },
        { id: 'printLabel', labelKey: 'c', defaultLabel: 'Print' },
      ],
      'confirm'
    );
    expect(ranked.primary?.id).toBe('confirm');
    expect(ranked.companion?.id).toBe('cancel');
    expect(ranked.overflow.map((a) => a.id)).toEqual(['printLabel']);
  });

  it('uses the sole remaining action as companion', () => {
    const ranked = rankOrderDetailActions([
      { id: 'pay', labelKey: 'a', defaultLabel: 'Pay', preferred: true },
      { id: 'ask_if_ready', labelKey: 'b', defaultLabel: 'Ask' },
    ]);
    expect(ranked.companion?.id).toBe('ask_if_ready');
    expect(ranked.overflow).toEqual([]);
  });
});

describe('rankBusinessOrderDetailActions', () => {
  it('ranks pending as confirm + cancel companion', () => {
    const ranked = rankBusinessOrderDetailActions(biz({ current_status: 'pending' }));
    expect(ranked.primary?.id).toBe('confirm');
    expect(ranked.companion?.id).toBe('cancel');
    expect(ranked.overflow).toEqual([]);
  });

  it('puts overwrite code alone as primary when out for delivery', () => {
    const ranked = rankBusinessOrderDetailActions(
      biz({ current_status: 'out_for_delivery' })
    );
    expect(ranked.primary?.id).toBe('generateOverwriteCode');
    expect(ranked.companion).toBeNull();
  });

  it('hides owner-only actions for delegates', () => {
    const ranked = rankBusinessOrderDetailActions(
      biz({ current_status: 'delivered' }),
      { mode: 'delegate' }
    );
    expect(ranked.primary).toBeNull();
  });
});

describe('rankAgentOrderDetailActions', () => {
  it('ranks assigned_to_agent as pickUp with release in overflow', () => {
    const ranked = rankAgentOrderDetailActions({
      status: 'assigned_to_agent',
      assignedAgentId: 'agent-1',
    });
    expect(ranked.primary?.id).toBe('pickUp');
    expect(ranked.overflow.map((a) => a.id)).toEqual(
      expect.arrayContaining(['runningLate', 'release', 'reportIssue'])
    );
  });

  it('keeps More-only items in overflow when there is no primary CTA', () => {
    const ranked = rankAgentOrderDetailActions({
      status: 'complete',
      assignedAgentId: null,
    });
    expect(ranked.primary).toBeNull();
    expect(ranked.overflow.map((a) => a.id)).toEqual(['reportIssue']);
  });

  it('hides everything for cancelled unassigned orders', () => {
    const ranked = rankAgentOrderDetailActions({
      status: 'cancelled',
      assignedAgentId: null,
    });
    expect(ranked.primary).toBeNull();
    expect(ranked.overflow).toEqual([]);
  });
});

describe('rankClientOrderDetailActions', () => {
  it('ranks pending with cancel companion', () => {
    const ranked = rankClientOrderDetailActions(
      client({ current_status: 'pending', payment_status: 'paid' })
    );
    expect(ranked.companion?.id).toBe('cancel');
  });

  it('puts reorder as primary when enabled on complete', () => {
    const ranked = rankClientOrderDetailActions(
      client({
        current_status: 'complete',
        completed_at: new Date().toISOString(),
      }),
      { reorderEnabled: true, canRate: true }
    );
    expect(ranked.primary?.id).toBe('reorder');
  });

  it('includes request_refund in overflow when within window', () => {
    const ranked = rankClientOrderDetailActions(
      client({
        current_status: 'complete',
        completed_at: new Date().toISOString(),
      }),
      { canRate: false }
    );
    const ids = [
      ranked.primary?.id,
      ranked.companion?.id,
      ...ranked.overflow.map((a) => a.id),
    ].filter(Boolean);
    expect(ids).toContain('request_refund');
  });
});
