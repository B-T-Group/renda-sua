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
});
