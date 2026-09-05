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
  let orders: { getOrderById: jest.Mock };
  let acceptance: {
    markBusy: jest.Mock;
    getPendingAcceptanceForLocation: jest.Mock;
  };
  let service: DelegateOrdersService;

  beforeEach(() => {
    hasura = { executeQuery: jest.fn() };
    orders = { getOrderById: jest.fn() };
    acceptance = {
      markBusy: jest.fn().mockResolvedValue({ success: true }),
      getPendingAcceptanceForLocation: jest.fn().mockResolvedValue({
        active: true,
      }),
    };
    service = new DelegateOrdersService(
      hasura as any,
      orders as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      acceptance as any
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

  it('marks Busy only after the order is in the active location', async () => {
    hasura.executeQuery.mockResolvedValue({
      orders_by_pk: {
        id: 'ord-1',
        business_id: 'biz-1',
        business_location_id: 'loc-1',
      },
    });
    await service.markBusy(ctx, 'ord-1');
    expect(acceptance.markBusy).toHaveBeenCalledWith('ord-1', {
      userId: 'user-1',
      asDelegateLocationId: 'loc-1',
    });
  });

  it('does not mark Busy for an order at another location', async () => {
    hasura.executeQuery.mockResolvedValue({
      orders_by_pk: {
        id: 'ord-2',
        business_id: 'biz-1',
        business_location_id: 'loc-other',
      },
    });
    await expect(service.markBusy(ctx, 'ord-2')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
    expect(acceptance.markBusy).not.toHaveBeenCalled();
  });

  it('loads pending acceptance for the delegated location', async () => {
    hasura.executeQuery.mockResolvedValue({
      business_locations_by_pk: { id: 'loc-1', business_id: 'biz-1' },
    });
    await expect(service.pendingAcceptance(ctx)).resolves.toEqual({
      active: true,
    });
    expect(acceptance.getPendingAcceptanceForLocation).toHaveBeenCalledWith(
      'biz-1',
      'loc-1'
    );
  });
});

describe('DelegateOrdersService status PATCH side effects', () => {
  const ctx: DelegationAccessContext = {
    userId: 'user-1',
    delegationId: 'grant-1',
    businessId: 'biz-1',
    locationId: 'loc-1',
    role: { id: 'role-om', key: 'order_manager', name: 'Order Manager' },
    permissions: ['delegation.orders.manage'],
  };
  const actor = {
    userId: 'user-1',
    businessId: 'biz-1',
    locationId: 'loc-1',
  };

  let hasura: { executeQuery: jest.Mock };
  let orders: {
    cancelOrder: jest.Mock;
    completePreparation: jest.Mock;
  };
  let orderStatus: { updateOrderStatus: jest.Mock };
  let service: DelegateOrdersService;

  beforeEach(() => {
    hasura = { executeQuery: jest.fn() };
    orders = {
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

  function stubOrderInLocation() {
    hasura.executeQuery.mockResolvedValue({
      orders_by_pk: {
        id: 'ord-1',
        business_id: 'biz-1',
        business_location_id: 'loc-1',
      },
    });
  }

  it('routes cancelled through cancelOrder so holds and inventory are released', async () => {
    stubOrderInLocation();

    await expect(service.updateStatus(ctx, 'ord-1', 'cancelled')).resolves.toEqual({
      success: true,
    });

    expect(orders.cancelOrder).toHaveBeenCalledWith({ orderId: 'ord-1' }, actor);
    expect(orderStatus.updateOrderStatus).not.toHaveBeenCalled();
    expect(orders.completePreparation).not.toHaveBeenCalled();
  });

  it('routes ready_for_pickup through completePreparation', async () => {
    stubOrderInLocation();

    await service.updateStatus(ctx, 'ord-1', 'ready_for_pickup');

    expect(orders.completePreparation).toHaveBeenCalledWith(
      { orderId: 'ord-1' },
      actor
    );
    expect(orders.cancelOrder).not.toHaveBeenCalled();
    expect(orderStatus.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('blocks confirmed because confirm requires a time slot', async () => {
    stubOrderInLocation();

    await expect(service.updateStatus(ctx, 'ord-1', 'confirmed')).rejects.toThrow(
      /time slot/
    );
    expect(orders.cancelOrder).not.toHaveBeenCalled();
    expect(orderStatus.updateOrderStatus).not.toHaveBeenCalled();
  });

  it('keeps other statuses on updateOrderStatus', async () => {
    stubOrderInLocation();

    await expect(service.updateStatus(ctx, 'ord-1', 'preparing')).resolves.toEqual({
      success: true,
      order: { id: 'ord-1' },
      message: 'Order status updated successfully',
    });
    expect(orderStatus.updateOrderStatus).toHaveBeenCalledWith(
      'ord-1',
      'preparing',
      actor
    );
    expect(orders.cancelOrder).not.toHaveBeenCalled();
  });

  it('does not change status when the order is outside the location', async () => {
    hasura.executeQuery.mockResolvedValue({
      orders_by_pk: {
        id: 'ord-2',
        business_id: 'biz-1',
        business_location_id: 'loc-other',
      },
    });

    await expect(
      service.updateStatus(ctx, 'ord-2', 'cancelled')
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    expect(orders.cancelOrder).not.toHaveBeenCalled();
    expect(orderStatus.updateOrderStatus).not.toHaveBeenCalled();
  });
});
