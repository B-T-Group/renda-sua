jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../commissions/commissions.service', () => ({
  CommissionsService: class CommissionsService {},
}));

import { HttpStatus } from '@nestjs/common';
import { OrdersService } from './orders.service';

describe('OrdersService carrier shipping', () => {
  const businessUser = {
    id: 'user-biz-1',
    business: { id: 'biz-1' },
  };
  const clientUser = {
    id: 'user-client-1',
    client: { id: 'client-1' },
  };

  let service: OrdersService;
  let hasuraUserService: {
    getUser: jest.Mock;
    sessionPersonaContext: jest.Mock;
  };
  let hasuraSystemService: { executeMutation: jest.Mock };
  let orderStatusService: { recordStatusChange: jest.Mock };
  let getOrderDetails: jest.SpyInstance;

  beforeEach(() => {
    hasuraUserService = {
      getUser: jest.fn(),
      sessionPersonaContext: jest.fn(),
    };
    hasuraSystemService = { executeMutation: jest.fn() };
    orderStatusService = {
      recordStatusChange: jest.fn().mockResolvedValue(undefined),
    };
    service = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(service, {
      hasuraUserService,
      hasuraSystemService,
      orderStatusService,
      logger: { error: jest.fn(), log: jest.fn(), warn: jest.fn() },
    });
    getOrderDetails = jest.spyOn(service as any, 'getOrderDetails');
  });

  function asBusiness() {
    hasuraUserService.getUser.mockResolvedValue(businessUser);
    hasuraUserService.sessionPersonaContext.mockReturnValue({
      activePersona: 'business',
      jwtDefaultRole: 'business',
      jwtAllowedRoles: ['business'],
    });
  }

  function asClient() {
    hasuraUserService.getUser.mockResolvedValue(clientUser);
    hasuraUserService.sessionPersonaContext.mockReturnValue({
      activePersona: 'client',
      jwtDefaultRole: 'client',
      jwtAllowedRoles: ['client'],
    });
  }

  function shippingOrder(overrides: Record<string, unknown> = {}) {
    return {
      id: 'ord-1',
      business_id: 'user-biz-1',
      client_id: 'user-client-1',
      fulfillment_method: 'shipping',
      current_status: 'confirmed',
      ...overrides,
    };
  }

  describe('markOrderAsShipped', () => {
    it('rejects non-business personas', async () => {
      asClient();
      await expect(service.markOrderAsShipped('ord-1')).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('rejects pickup orders and invalid statuses', async () => {
      asBusiness();
      getOrderDetails.mockResolvedValue(
        shippingOrder({ fulfillment_method: 'pickup' })
      );
      await expect(service.markOrderAsShipped('ord-1')).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });

      getOrderDetails.mockResolvedValue(
        shippingOrder({ current_status: 'pending' })
      );
      await expect(service.markOrderAsShipped('ord-1')).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('rejects a business that does not own the order', async () => {
      asBusiness();
      getOrderDetails.mockResolvedValue(
        shippingOrder({ business_id: 'other-user' })
      );
      await expect(service.markOrderAsShipped('ord-1')).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('writes shipped status, tracking, and history', async () => {
      asBusiness();
      getOrderDetails.mockResolvedValue(
        shippingOrder({ current_status: 'awaiting_shipment' })
      );
      const updated = {
        id: 'ord-1',
        current_status: 'shipped',
        shipping_tracking_number: '1Z999',
        shipping_carrier: 'UPS',
      };
      hasuraSystemService.executeMutation.mockResolvedValue({
        update_orders_by_pk: updated,
      });

      await expect(
        service.markOrderAsShipped('ord-1', '1Z999', 'UPS')
      ).resolves.toEqual({
        success: true,
        order: updated,
        message: 'Order marked as shipped',
      });
      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('MarkOrderAsShipped'),
        expect.objectContaining({
          orderId: 'ord-1',
          trackingNumber: '1Z999',
          carrier: 'UPS',
        })
      );
      expect(orderStatusService.recordStatusChange).toHaveBeenCalledWith(
        'ord-1',
        'shipped',
        'user-biz-1',
        'business'
      );
    });
  });

  describe('updateTrackingNumber', () => {
    it('rejects non-shipping orders', async () => {
      asBusiness();
      getOrderDetails.mockResolvedValue(
        shippingOrder({ fulfillment_method: 'delivery' })
      );
      await expect(
        service.updateTrackingNumber('ord-1', '1Z999')
      ).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    });

    it('updates tracking for the owning business', async () => {
      asBusiness();
      getOrderDetails.mockResolvedValue(shippingOrder());
      hasuraSystemService.executeMutation.mockResolvedValue({
        update_orders_by_pk: { id: 'ord-1', shipping_tracking_number: '1Z999' },
      });

      const result = await service.updateTrackingNumber('ord-1', '1Z999', 'DHL');
      expect(result.success).toBe(true);
      expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('UpdateTrackingNumber'),
        { orderId: 'ord-1', trackingNumber: '1Z999', carrier: 'DHL' }
      );
    });
  });

  describe('confirmOrderReceipt', () => {
    it('rejects non-clients and non-owners', async () => {
      asBusiness();
      await expect(service.confirmOrderReceipt('ord-1')).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
      });

      asClient();
      getOrderDetails.mockResolvedValue(
        shippingOrder({ client_id: 'other-user' })
      );
      await expect(service.confirmOrderReceipt('ord-1')).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
      });
    });

    it('rejects unshipped orders', async () => {
      asClient();
      getOrderDetails.mockResolvedValue(
        shippingOrder({ current_status: 'awaiting_shipment' })
      );
      await expect(service.confirmOrderReceipt('ord-1')).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('completes a shipped order for the owning client', async () => {
      asClient();
      getOrderDetails.mockResolvedValue(
        shippingOrder({ current_status: 'shipped' })
      );
      const updated = { id: 'ord-1', current_status: 'complete' };
      hasuraSystemService.executeMutation.mockResolvedValue({
        update_orders_by_pk: updated,
      });

      await expect(service.confirmOrderReceipt('ord-1')).resolves.toEqual({
        success: true,
        order: updated,
        message: 'Receipt confirmed; order complete',
      });
      expect(orderStatusService.recordStatusChange).toHaveBeenCalledWith(
        'ord-1',
        'complete',
        'user-client-1',
        'client'
      );
    });
  });
});
