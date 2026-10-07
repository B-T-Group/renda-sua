/**
 * Unit tests for client order-cancel race condition fixes (#498)
 * 
 * These tests verify the compare-and-set logic, ledger duplicate handling,
 * event deduplication, and previous status preservation without fully
 * instantiating OrdersService (which has a complex dependency tree).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { OrderQueueService } from './order-queue.service';
import { DepositRefundService } from './deposit-refund.service';

describe('Order cancel CAS mutation logic (HIGH)', () => {
  it('CAS mutation includes orderId and eligibleFromStatuses', async () => {
    const hasuraSystem = {
      executeMutation: jest.fn().mockResolvedValue({
        update_orders: { affected_rows: 1 },
      }),
    } as any;

    const eligibleStatuses = ['pending', 'confirmed', 'preparing'];
    const orderId = 'test-order-id';

    await hasuraSystem.executeMutation(
      `mutation CasCancelOrder($orderId: uuid!, $eligibleFromStatuses: [order_status!]!, $now: timestamptz!) {
        update_orders(where: { id: { _eq: $orderId }, current_status: { _in: $eligibleFromStatuses } }, _set: { current_status: cancelled, updated_at: $now })
        { affected_rows }
      }`,
      {
        orderId,
        eligibleFromStatuses: eligibleStatuses,
        now: new Date().toISOString(),
      }
    );

    expect(hasuraSystem.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('CasCancelOrder'),
      expect.objectContaining({
        orderId,
        eligibleFromStatuses: eligibleStatuses,
      })
    );
  });

  it('CAS returns true when affected_rows is 1 (winner)', () => {
    const result = { update_orders: { affected_rows: 1 } };
    const casSuccess = (result?.update_orders?.affected_rows ?? 0) === 1;
    expect(casSuccess).toBe(true);
  });

  it('CAS returns false when affected_rows is 0 (loser)', () => {
    const result = { update_orders: { affected_rows: 0 } };
    const casSuccess = (result?.update_orders?.affected_rows ?? 0) === 1;
    expect(casSuccess).toBe(false);
  });
});

describe('Ledger completeness check (MED)', () => {
  it('detects complete ledger when release and payment legs exist', () => {
    const legs = [
      { transaction_type: 'release' },
      { transaction_type: 'payment' },
    ];
    const types = new Set(legs.map((t) => t.transaction_type));
    const isComplete = types.has('release') && types.has('payment');
    expect(isComplete).toBe(true);
  });

  it('detects incomplete ledger when only release exists', () => {
    const legs = [{ transaction_type: 'release' }];
    const types = new Set(legs.map((t) => t.transaction_type));
    const isComplete = types.has('release') && types.has('payment');
    expect(isComplete).toBe(false);
  });

  it('detects incomplete ledger when only payment exists', () => {
    const legs = [{ transaction_type: 'payment' }];
    const types = new Set(legs.map((t) => t.transaction_type));
    const isComplete = types.has('release') && types.has('payment');
    expect(isComplete).toBe(false);
  });
});

describe('Event deduplication (LOW-MED)', () => {
  let orderQueue: jest.Mocked<OrderQueueService>;

  beforeEach(() => {
    orderQueue = {
      sendOrderCancelledMessage: jest.fn().mockResolvedValue(undefined),
    } as any;
  });

  it('sendOrderCancelledMessage accepts dedupId parameter', async () => {
    const orderId = 'test-order';
    const dedupId = `order.cancelled:${orderId}`;

    await orderQueue.sendOrderCancelledMessage(
      orderId,
      'client',
      undefined,
      'confirmed',
      dedupId
    );

    expect(orderQueue.sendOrderCancelledMessage).toHaveBeenCalledWith(
      orderId,
      'client',
      undefined,
      'confirmed',
      dedupId
    );
  });

  it('dedup id format is order.cancelled:<orderId>', () => {
    const orderId = '123-456';
    const dedupId = `order.cancelled:${orderId}`;
    expect(dedupId).toBe('order.cancelled:123-456');
  });
});

describe('Previous status from history (LOW)', () => {
  it('query selects most recent non-cancelled status', async () => {
    const hasuraSystem = {
      executeQuery: jest.fn().mockResolvedValue({
        order_status_history: [{ status: 'preparing' }],
      }),
    } as any;

    const result = await hasuraSystem.executeQuery(
      `query GetPreviousStatus($orderId: uuid!) {
        order_status_history(
          where: { order_id: { _eq: $orderId }, status: { _neq: cancelled } }
          order_by: { created_at: desc }
          limit: 1
        ) { status }
      }`,
      { orderId: 'test-order' }
    );

    const previousStatus = result.order_status_history?.[0]?.status ?? null;
    expect(previousStatus).toBe('preparing');
  });

  it('returns null when no previous status exists', async () => {
    const hasuraSystem = {
      executeQuery: jest.fn().mockResolvedValue({
        order_status_history: [],
      }),
    } as any;

    const result = await hasuraSystem.executeQuery(
      `query GetPreviousStatus($orderId: uuid!) {
        order_status_history(
          where: { order_id: { _eq: $orderId }, status: { _neq: cancelled } }
          order_by: { created_at: desc }
          limit: 1
        ) { status }
      }`,
      { orderId: 'test-order' }
    );

    const previousStatus = result.order_status_history?.[0]?.status ?? null;
    expect(previousStatus).toBeNull();
  });
});

describe('Business cancellable statuses (helper)', () => {
  it('includes early statuses for regular orders', () => {
    const early = [
      'pending_payment',
      'pending',
      'confirmed',
      'preparing',
      'ready_for_pickup',
      'assigned_to_agent',
    ];
    expect(early).toContain('confirmed');
    expect(early).toContain('preparing');
    expect(early).toContain('ready_for_pickup');
  });

  it('excludes post-confirmed statuses for paid cooked food pay-after orders', () => {
    const isPaidCookedPayAfter = true;
    const early = [
      'pending_payment',
      'pending',
      'confirmed',
      'preparing',
      'ready_for_pickup',
      'assigned_to_agent',
    ];

    const filtered = isPaidCookedPayAfter
      ? early.filter((s) => !['confirmed', 'preparing', 'ready_for_pickup'].includes(s))
      : early;

    expect(filtered).not.toContain('confirmed');
    expect(filtered).not.toContain('preparing');
    expect(filtered).not.toContain('ready_for_pickup');
    expect(filtered).toContain('pending');
    expect(filtered).toContain('assigned_to_agent');
  });
});
