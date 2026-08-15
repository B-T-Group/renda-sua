jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { HttpStatus } from '@nestjs/common';
import { DelegateOrdersService } from './delegate-orders.service';
import type { DelegationAccessContext } from './delegation.types';

describe('DelegateOrdersService location scope', () => {
  const ctx: DelegationAccessContext = {
    userId: 'user-1',
    delegationId: 'grant-1',
    businessId: 'biz-1',
    locationId: 'loc-1',
    role: { id: 'role-om', key: 'order_manager', name: 'Order Manager' },
    permissions: ['delegation.orders.read', 'delegation.orders.manage'],
  };

  const actor = {
    userId: 'user-1',
    businessId: 'biz-1',
    locationId: 'loc-1',
  };

  let hasura: { executeQuery: jest.Mock };
  let orders: {
    getOrderById: jest.Mock;
    cancelOrder: jest.Mock;
    completePreparation: jest.Mock;
  };
  let orderStatus: { updateOrderStatus: jest.Mock };
  let service: DelegateOrdersService;

  beforeEach(() => {
    hasura = { executeQuery: jest.fn() };
    orders = {
      getOrderById: jest.fn(),
      cancelOrder: jest.fn(),
      completePreparation: jest.fn(),
    };
    orderStatus = { updateOrderStatus: jest.fn() };
    service = new DelegateOrdersService(
      hasura as any,
      orders as any,
      orderStatus as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
  });

  function mockOrderInLocation() {
    hasura.executeQuery.mockResolvedValue({
      orders_by_pk: {
        id: 'ord-1',
        business_id: 'biz-1',
        business_location_id: 'loc-1',
      },
    });
  }

  it('blocks orders from another location', async () => {
    hasura.executeQuery.mockResolvedValue({
      orders_by_pk: {
        id: 'ord-2',
        business_id: 'biz-1',
        business_location_id: 'loc-other',
      },
    });
    await expect(service.getById(ctx, 'ord-2')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
    expect(orders.getOrderById).not.toHaveBeenCalled();
  });

  it('loads an order in the active location', async () => {
    hasura.executeQuery.mockResolvedValue({
      orders_by_pk: {
        id: 'ord-1',
        business_id: 'biz-1',
        business_location_id: 'loc-1',
      },
    });
    orders.getOrderById.mockResolvedValue({ id: 'ord-1' });
    await expect(service.getById(ctx, 'ord-1')).resolves.toEqual({ id: 'ord-1' });
    expect(orders.getOrderById).toHaveBeenCalledWith('ord-1', {
      userId: 'user-1',
      businessId: 'biz-1',
      locationId: 'loc-1',
    });
  });

  describe('updateStatus side-effect routing', () => {
    it('routes cancelled through cancelOrder so holds and inventory are released', async () => {
      mockOrderInLocation();
      orders.cancelOrder.mockResolvedValue({
        success: true,
        order: { id: 'ord-1', current_status: 'cancelled' },
        message: 'Order cancelled successfully',
      });

      const result = await service.updateStatus(ctx, 'ord-1', 'cancelled');

      expect(orders.cancelOrder).toHaveBeenCalledWith({ orderId: 'ord-1' }, actor);
      expect(orderStatus.updateOrderStatus).not.toHaveBeenCalled();
      expect(result.order.current_status).toBe('cancelled');
    });

    it('routes ready_for_pickup through completePreparation for dispatch and PIN', async () => {
      mockOrderInLocation();
      orders.completePreparation.mockResolvedValue({
        success: true,
        order: { id: 'ord-1', current_status: 'ready_for_pickup' },
        message: 'Order preparation completed successfully',
      });

      await service.updateStatus(ctx, 'ord-1', 'ready_for_pickup');

      expect(orders.completePreparation).toHaveBeenCalledWith(
        { orderId: 'ord-1' },
        actor
      );
      expect(orderStatus.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('rejects confirmed so a time slot cannot be skipped', async () => {
      mockOrderInLocation();
      await expect(
        service.updateStatus(ctx, 'ord-1', 'confirmed')
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
      expect(orders.cancelOrder).not.toHaveBeenCalled();
      expect(orderStatus.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('uses the generic status writer for other transitions', async () => {
      mockOrderInLocation();
      orderStatus.updateOrderStatus.mockResolvedValue({
        id: 'ord-1',
        current_status: 'preparing',
      });

      const result = await service.updateStatus(ctx, 'ord-1', 'preparing');

      expect(orderStatus.updateOrderStatus).toHaveBeenCalledWith(
        'ord-1',
        'preparing',
        actor
      );
      expect(result).toEqual({
        success: true,
        order: { id: 'ord-1', current_status: 'preparing' },
        message: 'Order status updated successfully',
      });
    });
  });
});
