import { HttpException } from '@nestjs/common';
import { ProductInterestService } from './product-interest.service';

describe('ProductInterestService', () => {
  const hasuraSystem = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const hasuraUser = {
    getUser: jest.fn(),
  };
  const notifications = {
    sendBusinessProductInterestNotification: jest.fn(),
  };

  let service: ProductInterestService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ProductInterestService(
      hasuraSystem as any,
      hasuraUser as any,
      notifications as any
    );
  });

  it('rejects non-clients', async () => {
    hasuraUser.getUser.mockResolvedValue({ id: 'u1', client: null });
    await expect(
      service.createInterest({ businessInventoryId: 'inv-1' })
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('rejects listings that are not interest_only', async () => {
    hasuraUser.getUser.mockResolvedValue({
      id: 'u1',
      client: { id: 'c1' },
      first_name: 'A',
      last_name: 'B',
    });
    hasuraSystem.executeQuery.mockResolvedValueOnce({
      business_inventory_by_pk: {
        id: 'inv-1',
        is_active: true,
        business_location_id: 'loc-1',
        item_id: 'item-1',
        business_location: {
          id: 'loc-1',
          name: 'Store',
          business_id: 'biz-1',
          business: { id: 'biz-1', name: 'Biz', user_id: 'bu1' },
        },
        item: {
          id: 'item-1',
          name: 'Part',
          interest_only: false,
          moderation_status: 'approved',
          is_active: true,
        },
      },
    });
    await expect(
      service.createInterest({ businessInventoryId: 'inv-1' })
    ).rejects.toMatchObject({ response: { error: 'NOT_INTEREST_ONLY' } });
  });

  it('creates interest and notifies business', async () => {
    hasuraUser.getUser.mockResolvedValue({
      id: 'u1',
      client: { id: 'c1' },
      first_name: 'A',
      last_name: 'B',
      email: 'a@b.com',
      phone_number: '+123',
    });
    hasuraSystem.executeQuery
      .mockResolvedValueOnce({
        business_inventory_by_pk: {
          id: 'inv-1',
          is_active: true,
          business_location_id: 'loc-1',
          item_id: 'item-1',
          business_location: {
            id: 'loc-1',
            name: 'Store',
            business_id: 'biz-1',
            business: { id: 'biz-1', name: 'Biz', user_id: 'bu1' },
          },
          item: {
            id: 'item-1',
            name: 'Part',
            interest_only: true,
            moderation_status: 'approved',
            is_active: true,
          },
        },
      })
      .mockResolvedValueOnce({ product_interest_requests: [] });
    hasuraSystem.executeMutation.mockResolvedValue({
      insert_product_interest_requests_one: {
        id: 'req-1',
        created_at: '2026-01-01',
        status: 'submitted',
      },
    });

    const result = await service.createInterest({
      businessInventoryId: 'inv-1',
      note: 'Need quote',
    });
    expect(result.id).toBe('req-1');
    expect(notifications.sendBusinessProductInterestNotification).toHaveBeenCalled();
  });

  it('rejects non-business users listing leads', async () => {
    hasuraUser.getUser.mockResolvedValue({ id: 'u1', business: null });
    await expect(service.listForBusiness()).rejects.toBeInstanceOf(HttpException);
    expect(hasuraSystem.executeQuery).not.toHaveBeenCalled();
  });

  it('lists business leads without unused GraphQL variables', async () => {
    hasuraUser.getUser.mockResolvedValue({
      id: 'u1',
      business: { id: 'biz-1' },
    });
    hasuraSystem.executeQuery.mockResolvedValue({
      product_interest_requests_aggregate: { aggregate: { count: 0 } },
      product_interest_requests: [],
    });

    const actual = await service.listForBusiness(1, 20);
    const [query, variables] = hasuraSystem.executeQuery.mock.calls[0];

    expect(actual.items).toEqual([]);
    expect(query).toContain('ListBusinessProductInterest');
    expect(query).not.toMatch(/\$businessId/);
    expect(variables).toEqual({
      where: { business_id: { _eq: 'biz-1' } },
      limit: 20,
      offset: 0,
    });
  });

  it('adds a location filter when listing leads for one store', async () => {
    hasuraUser.getUser.mockResolvedValue({
      id: 'u1',
      business: { id: 'biz-1' },
    });
    hasuraSystem.executeQuery.mockResolvedValue({
      product_interest_requests_aggregate: { aggregate: { count: 1 } },
      product_interest_requests: [{ id: 'req-1' }],
    });

    await service.listForBusiness(1, 20, 'loc-1');
    const [, variables] = hasuraSystem.executeQuery.mock.calls[0];

    expect(variables).toEqual({
      where: {
        business_id: { _eq: 'biz-1' },
        business_location_id: { _eq: 'loc-1' },
      },
      limit: 20,
      offset: 0,
    });
  });
});
