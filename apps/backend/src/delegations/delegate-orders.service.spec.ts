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
      cancelOrder: jest.fn().mockResolvedValue({ success: true }),
      completePreparation: jest.fn().mockResolvedValue({ success: true }),
    };
    orderStatus = {
      updateOrderStatus: jest.fn().mockResolvedValue({ id: 'ord-1' }),
    };
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

  it('lists orders with item images and store address for list confirm', async () => {
    hasura.executeQuery
      .mockResolvedValueOnce({
        business_locations_by_pk: { id: 'loc-1', business_id: 'biz-1' },
      })
      .mockResolvedValueOnce({ orders: [] });

    await expect(service.list(ctx)).resolves.toEqual([]);

    const listQuery = String(hasura.executeQuery.mock.calls[1][0]);
    expect(listQuery).toContain('item_images');
    expect(listQuery).toContain('display_url');
    expect(listQuery).toContain('variant_snapshot');
    expect(listQuery).toContain('business_location');
    expect(listQuery).toContain('delivery_time_windows');
    expect(listQuery).toMatch(/address\s*\{[\s\S]*\bstate\b[\s\S]*\bcountry\b/);
    expect(hasura.executeQuery.mock.calls[1][1]).toEqual({
      filters: { business_location_id: { _eq: 'loc-1' } },
    });
  });

  describe('updateStatus money-safe routing', () => {
    beforeEach(() => {
      hasura.executeQuery.mockResolvedValue({
        orders_by_pk: {
          id: 'ord-1',
          business_id: 'biz-1',
          business_location_id: 'loc-1',
        },
      });
    });

    it('cancels through cancelOrder so holds and inventory are released', async () => {
      await service.updateStatus(ctx, 'ord-1', 'cancelled');
      expect(orders.cancelOrder).toHaveBeenCalledWith(
        { orderId: 'ord-1' },
        { userId: 'user-1', businessId: 'biz-1', locationId: 'loc-1' }
      );
      expect(orderStatus.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('routes ready_for_pickup through completePreparation', async () => {
      await service.updateStatus(ctx, 'ord-1', 'ready_for_pickup');
      expect(orders.completePreparation).toHaveBeenCalledWith(
        { orderId: 'ord-1' },
        { userId: 'user-1', businessId: 'biz-1', locationId: 'loc-1' }
      );
    });

    it('blocks PATCH confirmed because a time slot is required', async () => {
      await expect(
        service.updateStatus(ctx, 'ord-1', 'confirmed')
      ).rejects.toThrow(/time slot/);
      expect(orderStatus.updateOrderStatus).not.toHaveBeenCalled();
    });

    it('keeps other statuses on the generic status service', async () => {
      await expect(
        service.updateStatus(ctx, 'ord-1', 'preparing')
      ).resolves.toEqual({
        success: true,
        order: { id: 'ord-1' },
        message: 'Order status updated successfully',
      });
      expect(orderStatus.updateOrderStatus).toHaveBeenCalledWith(
        'ord-1',
        'preparing',
        { userId: 'user-1', businessId: 'biz-1', locationId: 'loc-1' }
      );
    });
  });
});
