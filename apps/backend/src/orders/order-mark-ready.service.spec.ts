import { HttpException, HttpStatus } from '@nestjs/common';
import { OrderMarkReadyService } from './order-mark-ready.service';

describe('OrderMarkReadyService', () => {
  const hasura = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const hasuraUser = { getUser: jest.fn() };
  const waitAndExecute = { scheduleAcceptanceTimeout: jest.fn() };
  const notifications = {
    sendMarkReadyPromptNotifications: jest.fn(),
    sendClientReadyNudgeToBusiness: jest.fn(),
  };
  const service = new OrderMarkReadyService(
    hasura as never,
    hasuraUser as never,
    waitAndExecute as never,
    notifications as never
  );

  const confirmedOrder = {
    id: 'o1',
    order_number: 'ORD-1',
    current_status: 'confirmed',
    fulfillment_method: 'pickup',
    fulfillment_timing: 'asap',
    business_id: 'b1',
    business_location_id: 'loc1',
    client_ready_nudge_sent_at: null,
    client: { user_id: 'client-1' },
    business: { user_id: 'biz-1', user: { preferred_language: 'en' } },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    hasuraUser.getUser.mockResolvedValue({ id: 'client-1' });
    waitAndExecute.scheduleAcceptanceTimeout.mockResolvedValue(undefined);
    notifications.sendMarkReadyPromptNotifications.mockResolvedValue(undefined);
    notifications.sendClientReadyNudgeToBusiness.mockResolvedValue(undefined);
  });

  describe('scheduleAfterConfirm', () => {
    it('skips shipping and scheduled-window orders', async () => {
      await service.scheduleAfterConfirm({
        id: 'o1',
        business_id: 'b1',
        fulfillment_method: 'shipping',
        fulfillment_timing: 'asap',
      });
      await service.scheduleAfterConfirm({
        id: 'o2',
        business_id: 'b1',
        fulfillment_method: 'delivery',
        fulfillment_timing: 'scheduled',
        delivery_time_windows: [{ id: 'w1' }],
      });

      expect(waitAndExecute.scheduleAcceptanceTimeout).not.toHaveBeenCalled();
      expect(hasura.executeQuery).not.toHaveBeenCalled();
    });

    it('schedules the default 15-minute prompt for ASAP pickup', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        orders_aggregate: { aggregate: { count: 2 } },
      });

      await service.scheduleAfterConfirm({
        id: 'o1',
        business_id: 'b1',
        fulfillment_method: 'pickup',
        fulfillment_timing: 'asap',
      });

      expect(waitAndExecute.scheduleAcceptanceTimeout).toHaveBeenCalledWith(
        'order.mark_ready_prompt',
        { order_id: 'o1' },
        15 * 60
      );
      expect(hasura.executeQuery).toHaveBeenCalledTimes(1);
    });

    it('uses average prep minutes when the business has enough samples', async () => {
      hasura.executeQuery
        .mockResolvedValueOnce({
          orders_aggregate: { aggregate: { count: 5 } },
        })
        .mockResolvedValueOnce({
          orders: Array.from({ length: 5 }, (_, i) => ({
            accepted_at: '2026-01-01T10:00:00.000Z',
            order_status_history: [
              {
                status: 'ready_for_pickup',
                created_at: `2026-01-01T10:${String(20 + i).padStart(2, '0')}:00.000Z`,
              },
            ],
          })),
        });

      await service.scheduleAfterConfirm({
        id: 'o1',
        business_id: 'b1',
        fulfillment_method: 'delivery',
        fulfillment_timing: 'asap',
      });

      expect(waitAndExecute.scheduleAcceptanceTimeout).toHaveBeenCalledWith(
        'order.mark_ready_prompt',
        { order_id: 'o1' },
        22 * 60
      );
    });

    it('swallows scheduler failures so confirm still succeeds', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        orders_aggregate: { aggregate: { count: 0 } },
      });
      waitAndExecute.scheduleAcceptanceTimeout.mockRejectedValue(
        new Error('SFN down')
      );

      await expect(
        service.scheduleAfterConfirm({
          id: 'o1',
          business_id: 'b1',
          fulfillment_timing: 'asap',
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('onMarkReadyPrompt', () => {
    it('returns not found when the order is missing', async () => {
      hasura.executeQuery.mockResolvedValueOnce({ orders_by_pk: null });

      await expect(service.onMarkReadyPrompt('missing')).resolves.toEqual({
        success: false,
        reason: 'order_not_found',
      });
      expect(
        notifications.sendMarkReadyPromptNotifications
      ).not.toHaveBeenCalled();
    });

    it('skips when the order is no longer confirmed', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        orders_by_pk: { ...confirmedOrder, current_status: 'ready_for_pickup' },
      });

      await expect(service.onMarkReadyPrompt('o1')).resolves.toEqual({
        success: true,
        skipped: true,
        reason: 'not_confirmed',
      });
      expect(
        notifications.sendMarkReadyPromptNotifications
      ).not.toHaveBeenCalled();
    });

    it('notifies the merchant for a confirmed order', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        orders_by_pk: confirmedOrder,
      });

      await expect(service.onMarkReadyPrompt('o1')).resolves.toEqual({
        success: true,
      });
      expect(
        notifications.sendMarkReadyPromptNotifications
      ).toHaveBeenCalledWith({
        orderId: 'o1',
        orderNumber: 'ORD-1',
        businessUserId: 'biz-1',
        businessLocationId: 'loc1',
        preferredLanguage: 'en',
      });
    });
  });

  describe('remindReady', () => {
    it('rejects a missing order', async () => {
      hasura.executeQuery.mockResolvedValueOnce({ orders_by_pk: null });

      await expect(service.remindReady('missing')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });

    it('forbids a client who does not own the order', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        orders_by_pk: {
          ...confirmedOrder,
          client: { user_id: 'other-client' },
        },
      });

      const error = await service.remindReady('o1').catch((err: unknown) => err);
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect(hasura.executeMutation).not.toHaveBeenCalled();
    });

    it('rejects shipping and non-confirmed orders', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        orders_by_pk: { ...confirmedOrder, fulfillment_method: 'shipping' },
      });
      await expect(service.remindReady('o1')).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });

      hasura.executeQuery.mockResolvedValueOnce({
        orders_by_pk: { ...confirmedOrder, current_status: 'pending' },
      });
      await expect(service.remindReady('o1')).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
      expect(notifications.sendClientReadyNudgeToBusiness).not.toHaveBeenCalled();
    });

    it('rejects a second nudge from the already-stamped column', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        orders_by_pk: {
          ...confirmedOrder,
          client_ready_nudge_sent_at: '2026-01-01T10:00:00.000Z',
        },
      });

      await expect(service.remindReady('o1')).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
      expect(hasura.executeMutation).not.toHaveBeenCalled();
    });

    it('treats a lost CAS stamp as a one-time conflict', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        orders_by_pk: confirmedOrder,
      });
      hasura.executeMutation.mockResolvedValueOnce({
        update_orders: { affected_rows: 0 },
      });

      await expect(service.remindReady('o1')).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
      });
      expect(notifications.sendClientReadyNudgeToBusiness).not.toHaveBeenCalled();
    });

    it('stamps once then notifies the business', async () => {
      hasura.executeQuery.mockResolvedValueOnce({
        orders_by_pk: confirmedOrder,
      });
      hasura.executeMutation.mockResolvedValueOnce({
        update_orders: { affected_rows: 1 },
      });

      await expect(service.remindReady('o1')).resolves.toEqual({
        success: true,
        message: 'Reminder sent to the business',
      });
      expect(hasura.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('client_ready_nudge_sent_at: { _is_null: true }'),
        expect.objectContaining({ id: 'o1' })
      );
      expect(notifications.sendClientReadyNudgeToBusiness).toHaveBeenCalledWith({
        orderId: 'o1',
        orderNumber: 'ORD-1',
        businessUserId: 'biz-1',
        businessLocationId: 'loc1',
        preferredLanguage: 'en',
      });
    });
  });
});
