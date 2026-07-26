import { HttpException, HttpStatus } from '@nestjs/common';
import { StockAvailabilityService } from './stock-availability.service';

describe('StockAvailabilityService ownership revalidation', () => {
  const hasuraUserService = { getUser: jest.fn() };
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
    notificationsService.sendStockAvailabilityResultPush.mockResolvedValue(
      undefined
    );
  });

  function mockMessageAndInventory(ownerBusinessId: string) {
    hasuraSystemService.executeQuery.mockImplementation(
      async (query: string) => {
        if (query.includes('StockAvailMsg')) {
          return {
            user_messages_by_pk: {
              id: 'msg-1',
              message_type: 'STOCK_AVAILABILITY',
              entity_type: 'business_inventory',
              message_payload: pendingPayload,
            },
          };
        }
        if (query.includes('StockAvailInv')) {
          return {
            business_inventory_by_pk: {
              id: 'inv-1',
              item_id: 'item-1',
              quantity: 5,
              reserved_quantity: 0,
              computed_available_quantity: 5,
              business_location: {
                id: 'loc-2',
                name: 'Transferred',
                business_id: ownerBusinessId,
                business: {
                  id: ownerBusinessId,
                  name: 'Other Shop',
                  user_id: 'other-user',
                },
              },
              item: { id: 'item-1', name: 'Widget', item_images: [] },
            },
          };
        }
        if (query.includes('StockAvailUser')) {
          return { users_by_pk: { first_name: 'Sam', last_name: 'Client' } };
        }
        return {};
      }
    );
  }

  it('blocks adjust when inventory was transferred to another business', async () => {
    mockMessageAndInventory('biz-2');

    await expect(
      service.respond('msg-1', { action: 'adjust', quantity: 0 })
    ).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });

    const inventoryWrites =
      hasuraSystemService.executeMutation.mock.calls.filter(([mutation]) =>
        String(mutation).includes('SetStockQty')
      );
    expect(inventoryWrites).toHaveLength(0);
  });

  it('blocks getCheck when inventory no longer belongs to the message business', async () => {
    mockMessageAndInventory('biz-2');

    await expect(service.getCheck('msg-1')).rejects.toBeInstanceOf(
      HttpException
    );
    await expect(service.getCheck('msg-1')).rejects.toMatchObject({
      status: HttpStatus.FORBIDDEN,
    });
  });

  it('allows adjust when inventory still belongs to the responding business', async () => {
    mockMessageAndInventory('biz-1');
    hasuraSystemService.executeMutation.mockImplementation(
      async (mutation: string) => {
        if (mutation.includes('UpdateStockAvailIfPending')) {
          return { update_user_messages: { affected_rows: 1 } };
        }
        if (mutation.includes('SetStockQty')) {
          return { update_business_inventory_by_pk: { id: 'inv-1' } };
        }
        return {};
      }
    );

    const result = await service.respond('msg-1', {
      action: 'adjust',
      quantity: 4,
    });

    expect(result.status).toBe('adjusted');
    const inventoryWrites =
      hasuraSystemService.executeMutation.mock.calls.filter(([mutation]) =>
        String(mutation).includes('SetStockQty')
      );
    expect(inventoryWrites).toHaveLength(1);
  });
});
