jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { OrderCleanupService } from './order-cleanup.service';
import {
  CANCEL_REASON_NOT_PICKED_UP_IN_TIME,
  CANCEL_REASON_PAYMENT_NOT_COMPLETED,
} from './order-cleanup.constants';

describe('OrderCleanupService', () => {
  let service: OrderCleanupService;
  let hasura: {
    executeQuery: jest.Mock;
    executeMutation: jest.Mock;
  };
  let stripeCapture: { cancelOrderPaymentIntent: jest.Mock };
  let stripeRefund: { initiateOrderRefund: jest.Mock };
  let orderQueue: {
    sendOrderCancelledMessage: jest.Mock;
    sendOrderStatusUpdatedMessage: jest.Mock;
  };
  let notifications: { sendPendingPaymentCleanupDigestPush: jest.Mock };
  let deliveryConfig: { getTimezone: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(() => {
    hasura = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn().mockResolvedValue({}),
    };
    stripeCapture = {
      cancelOrderPaymentIntent: jest.fn().mockResolvedValue({
        success: true,
        skipped: false,
      }),
    };
    stripeRefund = {
      initiateOrderRefund: jest.fn().mockResolvedValue({ success: true }),
    };
    orderQueue = {
      sendOrderCancelledMessage: jest.fn().mockResolvedValue(undefined),
      sendOrderStatusUpdatedMessage: jest.fn().mockResolvedValue(undefined),
    };
    notifications = {
      sendPendingPaymentCleanupDigestPush: jest
        .fn()
        .mockResolvedValue(undefined),
    };
    deliveryConfig = {
      getTimezone: jest.fn().mockResolvedValue('UTC'),
    };
    config = {
      get: jest.fn().mockReturnValue({
        cleanupEnabled: true,
        cleanupGraceHours: 24,
        cleanupBatchLimit: 100,
        storePickupCancelDays: 7,
      }),
    };

    service = new OrderCleanupService(
      hasura as any,
      stripeCapture as any,
      stripeRefund as any,
      orderQueue as any,
      notifications as any,
      deliveryConfig as any,
      config as any
    );
  });

  describe('cancelStalePendingPaymentOrders', () => {
    it('cancels stale pending_payment and sends one digest per party', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({
          orders: [
            {
              id: 'o1',
              order_number: 'A1',
              current_status: 'pending_payment',
              payment_status: 'pending',
              payment_source: 'mobile_money',
              client: {
                user_id: 'client-1',
                user: { preferred_language: 'en' },
              },
              business: {
                user_id: 'biz-1',
                user: { preferred_language: 'en' },
              },
              order_items: [],
            },
            {
              id: 'o2',
              order_number: 'A2',
              current_status: 'pending_payment',
              payment_status: 'pending',
              payment_source: 'mobile_money',
              client: {
                user_id: 'client-1',
                user: { preferred_language: 'en' },
              },
              business: {
                user_id: 'biz-1',
                user: { preferred_language: 'en' },
              },
              order_items: [],
            },
          ],
        })
        .mockResolvedValueOnce({
          orders_by_pk: {
            payment_status: 'pending',
            payment_source: 'mobile_money',
          },
        })
        .mockResolvedValueOnce({
          orders_by_pk: {
            payment_status: 'pending',
            payment_source: 'mobile_money',
          },
        });
      hasura.executeMutation.mockImplementation((mutation: string) => {
        if (String(mutation).includes('CleanupClaimCancel')) {
          return Promise.resolve({ update_orders: { affected_rows: 1 } });
        }
        return Promise.resolve({});
      });

      const n = await service.cancelStalePendingPaymentOrders(24, 100);
      expect(n).toBe(2);

      const cancelMutations = hasura.executeMutation.mock.calls.filter((c) =>
        String(c[0]).includes('CleanupClaimCancel')
      );
      expect(cancelMutations).toHaveLength(2);
      expect(cancelMutations[0][1].reasonId).toBe(
        CANCEL_REASON_PAYMENT_NOT_COMPLETED
      );
      expect(cancelMutations[0][1].expectedStatus).toBe('pending_payment');

      // No per-order status.updated for pending_payment (digest only)
      expect(orderQueue.sendOrderStatusUpdatedMessage).not.toHaveBeenCalled();
      expect(orderQueue.sendOrderCancelledMessage).toHaveBeenCalledTimes(2);

      expect(
        notifications.sendPendingPaymentCleanupDigestPush
      ).toHaveBeenCalledTimes(2);
      const digestCalls =
        notifications.sendPendingPaymentCleanupDigestPush.mock.calls;
      const clientDigest = digestCalls.find((c) => c[0].persona === 'client');
      const businessDigest = digestCalls.find(
        (c) => c[0].persona === 'business'
      );
      expect(clientDigest[0].orderNumbers).toEqual(['A1', 'A2']);
      expect(businessDigest[0].orderNumbers).toEqual(['A1', 'A2']);
    });

    it('excludes orders still inside payment_failed grace', async () => {
      hasura.executeQuery.mockImplementation((query: string, vars: any) => {
        expect(String(query)).toContain('payment_failed_at');
        expect(vars.paymentFailedCutoff).toBeDefined();
        return Promise.resolve({ orders: [] });
      });
      const n = await service.cancelStalePendingPaymentOrders(24, 100);
      expect(n).toBe(0);
    });

    it('no-ops when CAS claim loses payment-finalize race', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        orders: [
          {
            id: 'o1',
            order_number: 'A1',
            current_status: 'pending_payment',
            client: { user_id: 'c1' },
            business: { user_id: 'b1' },
            order_items: [],
          },
        ],
      });
      hasura.executeMutation.mockResolvedValueOnce({
        update_orders: { affected_rows: 0 },
      });

      const n = await service.cancelStalePendingPaymentOrders(24, 100);
      expect(n).toBe(0);
      expect(stripeCapture.cancelOrderPaymentIntent).not.toHaveBeenCalled();
      expect(stripeRefund.initiateOrderRefund).not.toHaveBeenCalled();
      expect(orderQueue.sendOrderCancelledMessage).not.toHaveBeenCalled();
      expect(
        notifications.sendPendingPaymentCleanupDigestPush
      ).not.toHaveBeenCalled();
    });

    it('reverts cancelled claim when finalization fails before payment release', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({
          orders: [
            {
              id: 'o1',
              order_number: 'A1',
              current_status: 'pending_payment',
              payment_status: 'pending',
              payment_source: 'mobile_money',
              client: { user_id: 'c1' },
              business: { user_id: 'b1' },
              order_items: [],
            },
          ],
        })
        .mockRejectedValueOnce(new Error('payment read failed'));
      hasura.executeMutation.mockImplementation((mutation: string) => {
        const text = String(mutation);
        if (text.includes('CleanupClaimCancel')) {
          return Promise.resolve({ update_orders: { affected_rows: 1 } });
        }
        return Promise.resolve({});
      });

      await expect(service.cancelStalePendingPaymentOrders(24, 100)).rejects.toThrow(
        'payment read failed'
      );
      expect(
        hasura.executeMutation.mock.calls.some((c) =>
          String(c[0]).includes('RevertCancelledClaim')
        )
      ).toBe(true);
      const revertMutation = hasura.executeMutation.mock.calls.find((c) =>
        String(c[0]).includes('RevertCancelledClaim')
      )?.[0];
      expect(String(revertMutation)).toContain('cancelled_by: null');
      expect(orderQueue.sendOrderCancelledMessage).not.toHaveBeenCalled();
    });
  });

  describe('cancelMissedPickupOrders', () => {
    it('cancels ready_for_pickup when window + grace passed and notifies via status.updated', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({
          orders: [
            {
              id: 'o1',
              order_number: 'R1',
              current_status: 'ready_for_pickup',
              payment_status: 'authorized',
              payment_source: 'credit_card',
              pickup_by: '2026-08-01T12:00:00.000Z',
              delivery_address: { country: 'CA' },
              client: { user_id: 'c1', user: { timezone: 'UTC' } },
              business: { user_id: 'b1' },
              order_items: [],
              failed_delivery: [],
            },
          ],
        })
        .mockResolvedValueOnce({
          orders_by_pk: {
            payment_status: 'authorized',
            payment_source: 'credit_card',
          },
        });
      hasura.executeMutation.mockImplementation((mutation: string) => {
        if (String(mutation).includes('CleanupClaimCancel')) {
          return Promise.resolve({ update_orders: { affected_rows: 1 } });
        }
        return Promise.resolve({});
      });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-03T13:00:00.000Z'));
      const n = await service.cancelMissedPickupOrders(24, 100);
      jest.useRealTimers();

      expect(n).toBe(1);
      const cancel = hasura.executeMutation.mock.calls.find((c) =>
        String(c[0]).includes('CleanupClaimCancel')
      );
      expect(cancel[1].reasonId).toBe(CANCEL_REASON_NOT_PICKED_UP_IN_TIME);
      expect(cancel[1].expectedStatus).toBe('ready_for_pickup');
      const claimIdx = hasura.executeMutation.mock.calls.findIndex((c) =>
        String(c[0]).includes('CleanupClaimCancel')
      );
      const stripeCallOrder = stripeCapture.cancelOrderPaymentIntent.mock
        .invocationCallOrder[0];
      const claimCallOrder =
        hasura.executeMutation.mock.invocationCallOrder[claimIdx];
      expect(claimCallOrder).toBeLessThan(stripeCallOrder);
      expect(orderQueue.sendOrderStatusUpdatedMessage).toHaveBeenCalledWith(
        'o1',
        'ready_for_pickup',
        'cancelled',
        null
      );
      expect(stripeCapture.cancelOrderPaymentIntent).toHaveBeenCalled();
    });

    it('skips orders that are not yet stale', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        orders: [
          {
            id: 'o1',
            order_number: 'R1',
            current_status: 'ready_for_pickup',
            pickup_by: '2026-08-03T12:00:00.000Z',
            delivery_address: { country: 'CA' },
            client: { user: { timezone: 'UTC' } },
            order_items: [],
          },
        ],
      });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-03T13:00:00.000Z'));
      const n = await service.cancelMissedPickupOrders(24, 100);
      jest.useRealTimers();

      expect(n).toBe(0);
      expect(orderQueue.sendOrderCancelledMessage).not.toHaveBeenCalled();
    });

    it('does not cancel a late-prepped ASAP order from a stale placement promise', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        orders: [
          {
            id: 'o1',
            order_number: 'R1',
            current_status: 'ready_for_pickup',
            payment_status: 'authorized',
            payment_source: 'credit_card',
            promised_fulfill_by: '2026-08-01T19:30:00.000Z',
            pickup_by: '2026-08-02T20:00:00.000Z',
            delivery_address: { country: 'CA' },
            client: { user: { timezone: 'UTC' } },
            business: { user_id: 'b1' },
            order_items: [],
            failed_delivery: [],
          },
        ],
      });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-03T12:00:00.000Z'));
      const n = await service.cancelMissedPickupOrders(24, 100);
      jest.useRealTimers();

      expect(n).toBe(0);
      expect(stripeCapture.cancelOrderPaymentIntent).not.toHaveBeenCalled();
    });

    it('skips store-pickup orders even when window + grace would apply', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        orders: [
          {
            id: 'o1',
            order_number: 'P1',
            current_status: 'ready_for_pickup',
            fulfillment_method: 'pickup',
            payment_status: 'authorized',
            payment_source: 'credit_card',
            pickup_by: '2026-08-01T12:00:00.000Z',
            delivery_address: { country: 'CA' },
            client: { user: { timezone: 'UTC' } },
            business: { user_id: 'b1' },
            order_items: [],
            failed_delivery: [],
          },
        ],
      });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-03T13:00:00.000Z'));
      const n = await service.cancelMissedPickupOrders(24, 100);
      jest.useRealTimers();

      expect(n).toBe(0);
      expect(stripeCapture.cancelOrderPaymentIntent).not.toHaveBeenCalled();
      const query = String(hasura.executeQuery.mock.calls[0][0]);
      expect(query).toMatch(/fulfillment_method:\s*\{\s*_neq:\s*pickup\s*\}/);
    });
  });

  describe('cancelStaleStorePickupOrders', () => {
    it('cancels store pickup after 7 days in ready_for_pickup', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({
          orders: [
            {
              id: 'o1',
              order_number: 'P1',
              current_status: 'ready_for_pickup',
              fulfillment_method: 'pickup',
              payment_status: 'authorized',
              payment_source: 'credit_card',
              updated_at: '2026-08-01T12:00:00.000Z',
              client: { user_id: 'c1', user: { timezone: 'UTC' } },
              business: { user_id: 'b1' },
              order_items: [],
              order_status_history: [
                {
                  status: 'ready_for_pickup',
                  created_at: '2026-08-01T12:00:00.000Z',
                },
              ],
            },
          ],
        })
        .mockResolvedValueOnce({
          orders_by_pk: {
            payment_status: 'authorized',
            payment_source: 'credit_card',
          },
        });
      hasura.executeMutation.mockImplementation((mutation: string) => {
        if (String(mutation).includes('CleanupClaimCancel')) {
          return Promise.resolve({ update_orders: { affected_rows: 1 } });
        }
        return Promise.resolve({});
      });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-09T13:00:00.000Z'));
      const n = await service.cancelStaleStorePickupOrders(7, 100);
      jest.useRealTimers();

      expect(n).toBe(1);
      const cancel = hasura.executeMutation.mock.calls.find((c) =>
        String(c[0]).includes('CleanupClaimCancel')
      );
      expect(cancel[1].reasonId).toBe(CANCEL_REASON_NOT_PICKED_UP_IN_TIME);
      expect(orderQueue.sendOrderStatusUpdatedMessage).toHaveBeenCalledWith(
        'o1',
        'ready_for_pickup',
        'cancelled',
        null
      );
    });

    it('does not cancel store pickup before 7 days even if window+grace elapsed', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        orders: [
          {
            id: 'o1',
            order_number: 'P1',
            current_status: 'ready_for_pickup',
            fulfillment_method: 'pickup',
            payment_status: 'authorized',
            payment_source: 'credit_card',
            updated_at: '2026-08-02T12:00:00.000Z',
            client: { user_id: 'c1', user: { timezone: 'UTC' } },
            business: { user_id: 'b1' },
            order_items: [],
            order_status_history: [
              {
                status: 'ready_for_pickup',
                created_at: '2026-08-02T12:00:00.000Z',
              },
            ],
          },
        ],
      });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-04T13:00:00.000Z'));
      const n = await service.cancelStaleStorePickupOrders(7, 100);
      jest.useRealTimers();

      expect(n).toBe(0);
      expect(stripeCapture.cancelOrderPaymentIntent).not.toHaveBeenCalled();
    });

    it('cancels using updated_at when ready history is missing', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({
          orders: [
            {
              id: 'o1',
              order_number: 'P1',
              current_status: 'ready_for_pickup',
              fulfillment_method: 'pickup',
              payment_status: 'authorized',
              payment_source: 'credit_card',
              updated_at: '2026-08-01T12:00:00.000Z',
              client: { user_id: 'c1', user: { timezone: 'UTC' } },
              business: { user_id: 'b1' },
              order_items: [],
              order_status_history: [],
            },
          ],
        })
        .mockResolvedValueOnce({
          orders_by_pk: {
            payment_status: 'authorized',
            payment_source: 'credit_card',
          },
        });
      hasura.executeMutation.mockImplementation((mutation: string) => {
        if (String(mutation).includes('CleanupClaimCancel')) {
          return Promise.resolve({ update_orders: { affected_rows: 1 } });
        }
        return Promise.resolve({});
      });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-09T13:00:00.000Z'));
      const n = await service.cancelStaleStorePickupOrders(7, 100);
      jest.useRealTimers();

      expect(n).toBe(1);
      expect(
        hasura.executeMutation.mock.calls.some((c) =>
          String(c[0]).includes('CleanupClaimCancel')
        )
      ).toBe(true);
    });

    it('does not cancel when ready time cannot be resolved', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        orders: [
          {
            id: 'o1',
            order_number: 'P1',
            current_status: 'ready_for_pickup',
            fulfillment_method: 'pickup',
            payment_status: 'authorized',
            payment_source: 'credit_card',
            updated_at: 'not-a-date',
            client: { user_id: 'c1', user: { timezone: 'UTC' } },
            business: { user_id: 'b1' },
            order_items: [],
            order_status_history: [{ status: 'ready_for_pickup' }],
          },
        ],
      });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-09T13:00:00.000Z'));
      const n = await service.cancelStaleStorePickupOrders(7, 100);
      jest.useRealTimers();

      expect(n).toBe(0);
      expect(stripeCapture.cancelOrderPaymentIntent).not.toHaveBeenCalled();
    });

    it('queries only store-pickup ready_for_pickup rows', async () => {
      hasura.executeQuery.mockResolvedValueOnce({ orders: [] });
      await service.cancelStaleStorePickupOrders(7, 100);
      const query = String(hasura.executeQuery.mock.calls[0][0]);
      expect(query).toMatch(/current_status:\s*\{\s*_eq:\s*ready_for_pickup\s*\}/);
      expect(query).toMatch(/fulfillment_method:\s*\{\s*_eq:\s*pickup\s*\}/);
    });
  });

  describe('failMissedDeliveryOrders', () => {
    it('marks mid-fulfillment orders failed and creates failed_deliveries', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({
          delivery_failure_reasons: [{ id: 'reason-uuid' }],
        })
        .mockResolvedValueOnce({
          orders: [
            {
              id: 'o1',
              order_number: 'D1',
              current_status: 'out_for_delivery',
              pickup_by: '2026-08-01T12:00:00.000Z',
              delivery_address: { country: 'CA' },
              client: { user: { timezone: 'UTC' } },
              order_items: [],
              failed_delivery: [],
            },
          ],
        });
      hasura.executeMutation.mockImplementation((mutation: string) => {
        if (String(mutation).includes('CleanupClaimFail')) {
          return Promise.resolve({ update_orders: { affected_rows: 1 } });
        }
        return Promise.resolve({});
      });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-03T13:00:00.000Z'));
      const n = await service.failMissedDeliveryOrders(24, 100);
      jest.useRealTimers();

      expect(n).toBe(1);
      expect(
        hasura.executeMutation.mock.calls.some((c) =>
          String(c[0]).includes('CleanupClaimFail')
        )
      ).toBe(true);
      expect(
        hasura.executeMutation.mock.calls.find((c) =>
          String(c[0]).includes('CleanupClaimFail')
        )?.[1]
      ).toEqual(
        expect.objectContaining({
          orderId: 'o1',
          expectedStatus: 'out_for_delivery',
        })
      );
      expect(
        hasura.executeMutation.mock.calls.some((c) =>
          String(c[0]).includes('CleanupInsertFailedDelivery')
        )
      ).toBe(true);
      expect(orderQueue.sendOrderCancelledMessage).not.toHaveBeenCalled();
      expect(orderQueue.sendOrderStatusUpdatedMessage).toHaveBeenCalledWith(
        'o1',
        'out_for_delivery',
        'failed',
        null
      );
    });

    it('does not report success when failed_delivery insert fails', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({
          delivery_failure_reasons: [{ id: 'reason-uuid' }],
        })
        .mockResolvedValueOnce({
          orders: [
            {
              id: 'o1',
              order_number: 'D1',
              current_status: 'out_for_delivery',
              pickup_by: '2026-08-01T12:00:00.000Z',
              client: { user: { timezone: 'UTC' } },
              order_items: [],
              failed_delivery: [],
            },
          ],
        });
      hasura.executeMutation.mockImplementation((mutation: string) => {
        if (String(mutation).includes('CleanupClaimFail')) {
          return Promise.resolve({ update_orders: { affected_rows: 1 } });
        }
        if (String(mutation).includes('CleanupInsertFailedDelivery')) {
          return Promise.reject(new Error('insert failed'));
        }
        return Promise.resolve({});
      });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-03T13:00:00.000Z'));
      await expect(service.failMissedDeliveryOrders(24, 100)).rejects.toThrow(
        'insert failed'
      );
      jest.useRealTimers();

      expect(
        hasura.executeMutation.mock.calls.some((c) =>
          String(c[0]).includes('RevertFailedClaim')
        )
      ).toBe(true);
      expect(orderQueue.sendOrderStatusUpdatedMessage).not.toHaveBeenCalled();
    });

    it('no-ops when CAS claim loses complete/delivered race', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({
          delivery_failure_reasons: [{ id: 'reason-uuid' }],
        })
        .mockResolvedValueOnce({
          orders: [
            {
              id: 'o1',
              order_number: 'D1',
              current_status: 'out_for_delivery',
              pickup_by: '2026-08-01T12:00:00.000Z',
              client: { user: { timezone: 'UTC' } },
              order_items: [],
              failed_delivery: [],
            },
          ],
        });
      hasura.executeMutation.mockResolvedValueOnce({
        update_orders: { affected_rows: 0 },
      });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-03T13:00:00.000Z'));
      const n = await service.failMissedDeliveryOrders(24, 100);
      jest.useRealTimers();

      expect(n).toBe(0);
      expect(
        hasura.executeMutation.mock.calls.some((c) =>
          String(c[0]).includes('CleanupInsertFailedDelivery')
        )
      ).toBe(false);
      expect(orderQueue.sendOrderStatusUpdatedMessage).not.toHaveBeenCalled();
    });

    it('skips when failed_delivery already exists', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({
          delivery_failure_reasons: [{ id: 'reason-uuid' }],
        })
        .mockResolvedValueOnce({
          orders: [
            {
              id: 'o1',
              order_number: 'D1',
              current_status: 'picked_up',
              pickup_by: '2026-08-01T12:00:00.000Z',
              client: { user: { timezone: 'UTC' } },
              failed_delivery: [{ id: 'fd1' }],
            },
          ],
        });

      jest.useFakeTimers().setSystemTime(new Date('2026-08-03T13:00:00.000Z'));
      const n = await service.failMissedDeliveryOrders(24, 100);
      jest.useRealTimers();

      expect(n).toBe(0);
    });
  });

  describe('runDailyCleanup', () => {
    it('skips when disabled', async () => {
      config.get.mockReturnValue({ cleanupEnabled: false });
      const spy = jest.spyOn(service, 'cancelStalePendingPaymentOrders');
      const result = await service.runDailyCleanup();
      expect(spy).not.toHaveBeenCalled();
      expect(result.skipped).toBe(true);
    });
  });

  describe('cancelUnpaidPendingPaymentAsSystem', () => {
    it('cancels pending_payment orders', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({
          orders_by_pk: {
            id: 'o1',
            order_number: 'A1',
            current_status: 'pending_payment',
            payment_status: 'pending',
            payment_source: 'mobile_money',
            order_items: [],
          },
        })
        .mockResolvedValueOnce({
          orders_by_pk: {
            payment_status: 'pending',
            payment_source: 'mobile_money',
          },
        });
      hasura.executeMutation.mockImplementation((mutation: string) => {
        if (String(mutation).includes('CleanupClaimCancel')) {
          return Promise.resolve({ update_orders: { affected_rows: 1 } });
        }
        return Promise.resolve({});
      });

      const result = await service.cancelUnpaidPendingPaymentAsSystem(
        'o1',
        'Timeout'
      );
      expect(result).toEqual({ cancelled: true });
    });

    it('skips when order is no longer pending_payment', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        orders_by_pk: {
          id: 'o1',
          order_number: 'A1',
          current_status: 'pending',
          payment_status: 'paid',
          payment_source: 'wallet',
          order_items: [],
        },
      });

      const result = await service.cancelUnpaidPendingPaymentAsSystem(
        'o1',
        'Timeout'
      );
      expect(result).toEqual({
        cancelled: false,
        skipped: true,
        reason: 'status_pending',
      });
    });

    it('skips payment_failed_grace until grace elapses', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        orders_by_pk: {
          id: 'o1',
          order_number: 'A1',
          current_status: 'pending_payment',
          payment_status: 'failed',
          payment_failed_at: new Date().toISOString(),
          payment_source: 'mobile_money',
          order_items: [],
        },
      });

      const result = await service.cancelUnpaidPendingPaymentAsSystem(
        'o1',
        'Grace',
        { reason: 'payment_failed_grace' }
      );
      expect(result).toEqual({
        cancelled: false,
        skipped: true,
        reason: 'grace_not_elapsed',
      });
    });
  });
});

