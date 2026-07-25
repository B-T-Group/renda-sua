import { HttpException, HttpStatus } from '@nestjs/common';
import { StockAvailabilityService } from './stock-availability.service';

describe('StockAvailabilityService', () => {
  const hasuraUserService = {
    getUser: jest.fn(),
  };
  const hasuraSystemService = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const notificationsService = {
    sendStockAvailabilityResultPush: jest.fn(),
  };

  let service: StockAvailabilityService;

  const pendingPayload = {
    version: 1 as const,
    status: 'pending' as const,
    inventoryId: 'inv-1',
    itemId: 'item-1',
    businessId: 'biz-1',
    clientUserId: 'client-1',
    quantityAtRequest: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StockAvailabilityService(
      hasuraUserService as never,
      hasuraSystemService as never,
      notificationsService as never
    );
    hasuraUserService.getUser.mockResolvedValue({
      id: 'biz-user-1',
      user_type_id: 'business',
      business: { id: 'biz-1', status: 'active' },
    });
    notificationsService.sendStockAvailabilityResultPush.mockResolvedValue(undefined);
  });

  function mockPendingMessage() {
    hasuraSystemService.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('StockAvailMsg')) {
        return {
          user_messages_by_pk: {
            id: 'msg-1',
            message_type: 'STOCK_AVAILABILITY',
            entity_type: 'business_inventory',
            message_payload: pendingPayload,
            user_id: 'biz-user-1',
          },
        };
      }
      if (query.includes('StockAvailInv')) {
        return {
          business_inventory_by_pk: {
            id: 'inv-1',
            item_id: 'item-1',
            quantity: 5,
            reserved_quantity: 3,
            computed_available_quantity: 2,
            business_location: {
              id: 'loc-1',
              name: 'Main',
              business_id: 'biz-1',
              business: { id: 'biz-1', name: 'Shop', user_id: 'biz-user-1' },
            },
            item: { id: 'item-1', name: 'Widget', item_images: [] },
          },
        };
      }
      if (query.includes('StockAvailUser')) {
        return { users_by_pk: { first_name: 'Sam', last_name: 'Client' } };
      }
      return {};
    });
  }

  it('claims pending payload before writing inventory on adjust', async () => {
    mockPendingMessage();
    const order: string[] = [];
    hasuraSystemService.executeMutation.mockImplementation(async (mutation: string) => {
      if (mutation.includes('UpdateStockAvailIfPending')) {
        order.push('claim');
        return { update_user_messages: { affected_rows: 1 } };
      }
      if (mutation.includes('SetStockQty')) {
        order.push('inventory');
        return { update_business_inventory_by_pk: { id: 'inv-1' } };
      }
      return {};
    });

    await service.respond('msg-1', { action: 'adjust', quantity: 10 });

    expect(order).toEqual(['claim', 'inventory']);
  });

  it('persists on-hand as available plus reserved when adjusting stock', async () => {
    mockPendingMessage();
    hasuraSystemService.executeMutation.mockImplementation(async (mutation: string) => {
      if (mutation.includes('UpdateStockAvailIfPending')) {
        return { update_user_messages: { affected_rows: 1 } };
      }
      if (mutation.includes('SetStockQty')) {
        return { update_business_inventory_by_pk: { id: 'inv-1' } };
      }
      return {};
    });

    await service.respond('msg-1', { action: 'adjust', quantity: 10 });

    const inventoryCall = hasuraSystemService.executeMutation.mock.calls.find(
      ([mutation]) => String(mutation).includes('SetStockQty')
    );
    expect(inventoryCall?.[1]).toEqual({
      id: 'inv-1',
      updates: { quantity: 13 },
    });
  });

  it('does not write inventory when pending claim loses the race', async () => {
    mockPendingMessage();
    hasuraSystemService.executeMutation.mockImplementation(async (mutation: string) => {
      if (mutation.includes('UpdateStockAvailIfPending')) {
        return { update_user_messages: { affected_rows: 0 } };
      }
      return {};
    });

    try {
      await service.respond('msg-1', { action: 'adjust', quantity: 10 });
      fail('Expected conflict');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    }

    const inventoryWrites = hasuraSystemService.executeMutation.mock.calls.filter(
      ([mutation]) => String(mutation).includes('SetStockQty')
    );
    expect(inventoryWrites).toHaveLength(0);
  });
});
