import { describe, expect, it } from 'vitest';
import {
  buildActiveOrderCardModel,
  isActiveOrderStatus,
  receivedAgoParts,
  sortActiveOrders,
} from './buildActiveOrderCardModel';
import { partitionOrdersByActivity } from './orderListGrouping';
import type { BusinessOrder } from '../types/business/orders';

const t = (key: string, defaultValue?: string) => defaultValue ?? key;

function order(partial: Partial<BusinessOrder> & { id: string }): BusinessOrder {
  return {
    order_number: '1042',
    client_id: 'c1',
    business_id: 'b1',
    business_location_id: 'l1',
    delivery_address_id: 'a1',
    tax_amount: 0,
    currency: 'XAF',
    current_status: 'pending',
    created_at: '2026-08-13T12:00:00Z',
    updated_at: '2026-08-13T12:00:00Z',
    total_amount: 14500,
    order_items: [
      { id: 'i1', quantity: 2, item_name: 'Widget', unit_price: 7250, total_price: 14500 },
    ],
    client: {
      id: 'c1',
      user: { id: 'u1', first_name: 'Ada', last_name: 'Lovelace' },
    },
    ...partial,
  } as BusinessOrder;
}

describe('isActiveOrderStatus / partition', () => {
  it('keeps pending through out_for_delivery and refund_requested as active', () => {
    const statuses = [
      'pending',
      'confirmed',
      'preparing',
      'ready_for_pickup',
      'assigned_to_agent',
      'picked_up',
      'in_transit',
      'out_for_delivery',
      'refund_requested',
    ];
    for (const status of statuses) {
      expect(isActiveOrderStatus(status)).toBe(true);
    }
  });

  it('treats delivered/cancelled/failed/refunded and resolved refunds as terminal', () => {
    for (const status of [
      'delivered',
      'complete',
      'completed',
      'cancelled',
      'failed',
      'refunded',
      'refund_approved_full',
      'refund_processing',
      'refund_rejected',
    ]) {
      expect(isActiveOrderStatus(status)).toBe(false);
    }
  });

  it('partitions mixed lists with refund_requested still active', () => {
    const { active, completed, cancelled } = partitionOrdersByActivity([
      order({ id: '1', current_status: 'pending' }),
      order({ id: '2', current_status: 'delivered' }),
      order({ id: '3', current_status: 'cancelled' }),
      order({ id: '4', current_status: 'refund_requested' }),
    ]);
    expect(active.map((o) => o.id)).toEqual(['1', '4']);
    expect(completed.map((o) => o.id)).toEqual(['2']);
    expect(cancelled.map((o) => o.id)).toEqual(['3']);
  });
});

describe('buildActiveOrderCardModel', () => {
  it('maps pending to Accept Order / incoming overlay', () => {
    const model = buildActiveOrderCardModel(
      order({ id: 'o1', current_status: 'pending' }),
      t
    );
    expect(model.titleDefault).toBe('New Order');
    expect(model.ctaDefault).toBe('Accept Order');
    expect(model.destination).toEqual({ kind: 'incoming_overlay' });
    expect(model.urgency).toBe('warning');
    expect(model.itemCount).toBe(2);
    expect(model.customerName).toBe('Ada Lovelace');
  });

  it('maps scheduled pending to Open Order instead of Accept overlay', () => {
    const model = buildActiveOrderCardModel(
      order({
        id: 'o1',
        current_status: 'pending',
        acceptance_state: 'scheduled',
      }),
      t
    );
    expect(model.ctaDefault).toBe('Open Order');
    expect(model.destination).toEqual({ kind: 'order_detail' });
  });

  it('maps preparing to Mark Ready / perform action', () => {
    const model = buildActiveOrderCardModel(
      order({ id: 'o1', current_status: 'preparing' }),
      t
    );
    expect(model.titleDefault).toBe('Preparing Order');
    expect(model.ctaDefault).toBe('Mark Ready');
    expect(model.destination).toEqual({ kind: 'perform_action' });
  });

  it('maps ready delivery to View Status', () => {
    const model = buildActiveOrderCardModel(
      order({
        id: 'o1',
        current_status: 'ready_for_pickup',
        fulfillment_method: 'delivery',
      }),
      t
    );
    expect(model.titleDefault).toBe('Ready for Pickup');
    expect(model.ctaDefault).toBe('View Status');
  });

  it('maps assigned / out for delivery to Track Delivery', () => {
    const assigned = buildActiveOrderCardModel(
      order({ id: 'o1', current_status: 'assigned_to_agent' }),
      t
    );
    expect(assigned.ctaDefault).toBe('Track Delivery');
    const ofd = buildActiveOrderCardModel(
      order({ id: 'o2', current_status: 'out_for_delivery' }),
      t
    );
    expect(ofd.titleDefault).toBe('Out for Delivery');
    expect(ofd.ctaDefault).toBe('Track Delivery');
  });

  it('maps refund_requested to Manage Refund', () => {
    const model = buildActiveOrderCardModel(
      order({ id: 'o1', current_status: 'refund_requested' }),
      t
    );
    expect(model.destination).toEqual({ kind: 'refunds' });
    expect(model.ctaDefault).toBe('Manage Refund');
  });
});

describe('sortActiveOrders', () => {
  it('puts action-needed pending before waiting ready orders', () => {
    const sorted = sortActiveOrders([
      order({
        id: 'ready',
        current_status: 'ready_for_pickup',
        fulfillment_method: 'delivery',
        created_at: '2026-08-13T14:00:00Z',
      }),
      order({
        id: 'pending',
        current_status: 'pending',
        created_at: '2026-08-13T10:00:00Z',
      }),
    ]);
    expect(sorted[0]?.id).toBe('pending');
  });
});

describe('receivedAgoParts', () => {
  it('formats minutes and hours', () => {
    const now = Date.parse('2026-08-13T12:10:00Z');
    expect(receivedAgoParts('2026-08-13T12:07:00Z', now)).toEqual({
      key: 'business.dashboard.activeOrders.receivedMinutes',
      defaultValue: 'Received {{count}} minutes ago',
      count: 3,
    });
    expect(receivedAgoParts('2026-08-13T10:10:00Z', now).count).toBe(2);
  });
});
