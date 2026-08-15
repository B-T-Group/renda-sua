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
  let service: DelegateOrdersService;

  beforeEach(() => {
    hasura = { executeQuery: jest.fn() };
    orders = { getOrderById: jest.fn() };
    service = new DelegateOrdersService(
      hasura as any,
      orders as any,
      {} as any,
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

  it('returns 404 when the order does not exist', async () => {
    hasura.executeQuery.mockResolvedValue({ orders_by_pk: null });
    await expect(service.getById(ctx, 'missing')).rejects.toMatchObject({
      status: HttpStatus.NOT_FOUND,
    });
    expect(orders.getOrderById).not.toHaveBeenCalled();
  });

  it('blocks orders from another business at the same location id', async () => {
    hasura.executeQuery.mockResolvedValue({
      orders_by_pk: {
        id: 'ord-3',
        business_id: 'biz-other',
        business_location_id: 'loc-1',
      },
    });
    await expect(service.getById(ctx, 'ord-3')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('checks every batch order before completing preparation', async () => {
    const batch = { completePreparationBatch: jest.fn() };
    service = new DelegateOrdersService(
      hasura as any,
      batch as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    hasura.executeQuery.mockImplementation(async (_q: string, vars: { id: string }) => {
      if (vars.id === 'ord-ok') {
        return {
          orders_by_pk: {
            id: 'ord-ok',
            business_id: 'biz-1',
            business_location_id: 'loc-1',
          },
        };
      }
      return {
        orders_by_pk: {
          id: vars.id,
          business_id: 'biz-1',
          business_location_id: 'loc-other',
        },
      };
    });

    await expect(
      service.completePreparationBatch(ctx, {
        orderIds: ['ord-ok', 'ord-other'],
      } as any)
    ).rejects.toMatchObject({ status: HttpStatus.FORBIDDEN });
    expect(batch.completePreparationBatch).not.toHaveBeenCalled();
  });

  it('lists only the active location and applies a status filter', async () => {
    hasura.executeQuery.mockImplementation(async (query: string) => {
      if (String(query).includes('DelegateLocation')) {
        return {
          business_locations_by_pk: { id: 'loc-1', business_id: 'biz-1' },
        };
      }
      return {
        orders: [
          { id: 'ord-1', current_status: 'pending' },
          { id: 'ord-2', current_status: 'confirmed' },
        ],
      };
    });
    await expect(
      service.list(ctx, { current_status: 'pending' })
    ).resolves.toEqual([{ id: 'ord-1', current_status: 'pending' }]);
  });

  it('forbids listing when the location no longer belongs to the business', async () => {
    hasura.executeQuery.mockResolvedValue({
      business_locations_by_pk: { id: 'loc-1', business_id: 'biz-other' },
    });
    await expect(service.list(ctx)).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
  });
});
