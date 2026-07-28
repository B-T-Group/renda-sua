import { HttpException, HttpStatus } from '@nestjs/common';
import {
  LOW_STOCK_THRESHOLD,
  StockAvailabilityService,
} from './stock-availability.service';
import type { StockAvailabilityPayloadV1 } from '../messaging/structured/structured-message.types';

describe('StockAvailabilityService', () => {
  const inventoryId = 'inv-1';
  const messageId = 'msg-1';
  const clientUserId = 'user-client';
  const businessUserId = 'user-business';
  const businessId = 'biz-1';

  const pendingPayload: StockAvailabilityPayloadV1 = {
    version: 1,
    status: 'pending',
    inventoryId,
    itemId: 'item-1',
    businessId,
    clientUserId,
    quantityAtRequest: 3,
  };

  const inventoryRow = {
    id: inventoryId,
    item_id: 'item-1',
    quantity: 5,
    reserved_quantity: 2,
    computed_available_quantity: 3,
    business_location: {
      id: 'loc-1',
      name: 'Main Store',
      business_id: businessId,
      business: {
        id: businessId,
        name: 'Acme',
        user_id: businessUserId,
        user: { first_name: 'Biz', last_name: 'Owner' },
      },
    },
    item: {
      id: 'item-1',
      name: 'Widget',
      item_images: [
        { image_url: 'https://cdn.example/gallery.jpg', image_type: 'gallery' },
        { image_url: 'https://cdn.example/main.jpg', image_type: 'main' },
      ],
    },
  };

  const clientUser = {
    id: clientUserId,
    user_type_id: 'client', active_persona: 'client',
    first_name: 'Sam',
    last_name: 'Shopper',
    client: { id: 'client-1' },
  };

  const businessUser = {
    id: businessUserId,
    user_type_id: 'business', active_persona: 'business',
    first_name: 'Biz',
    last_name: 'Owner',
    business: { id: businessId },
  };

  function buildService(options?: {
    user?: any;
    inventory?: any;
    recentMessages?: Array<{
      id: string;
      message_payload: StockAvailabilityPayloadV1;
    }>;
    message?: any;
    updateAffectedRows?: number;
  }) {
    const user = options?.user ?? clientUser;
    const inventory = options?.inventory ?? inventoryRow;
    const hasuraUserService = {
      getUser: jest.fn().mockResolvedValue(user),
    };
    const executeQuery = jest.fn(async (query: string) => {
      if (query.includes('StockAvailInv')) {
        return { business_inventory_by_pk: inventory };
      }
      if (query.includes('RecentChecks')) {
        return { user_messages: options?.recentMessages ?? [] };
      }
      if (query.includes('StockAvailMsg')) {
        return {
          user_messages_by_pk: options?.message ?? {
            id: messageId,
            message_type: 'STOCK_AVAILABILITY',
            entity_type: 'business_inventory',
            message_payload: pendingPayload,
          },
        };
      }
      if (query.includes('StockAvailUser')) {
        return {
          users_by_pk: { first_name: 'Sam', last_name: 'Shopper' },
        };
      }
      return {};
    });
    const executeMutation = jest.fn(async (mutation: string) => {
      if (mutation.includes('InsertStockAvailRecipient')) {
        return { insert_message_recipients: { affected_rows: 1 } };
      }
      if (mutation.includes('InsertStockAvail')) {
        return { insert_user_messages_one: { id: messageId } };
      }
      if (mutation.includes('UpdateStockAvailIfPending')) {
        return {
          update_user_messages: {
            affected_rows: options?.updateAffectedRows ?? 1,
          },
        };
      }
      if (mutation.includes('SetStockQty')) {
        return { update_business_inventory_by_pk: { id: inventoryId } };
      }
      return {};
    });
    const hasuraSystemService = { executeQuery, executeMutation };
    const notificationsService = {
      sendStockAvailabilityCheckPush: jest.fn().mockResolvedValue(undefined),
      sendStockAvailabilityResultPush: jest.fn().mockResolvedValue(undefined),
    };
    const service = new StockAvailabilityService(
      hasuraUserService as any,
      hasuraSystemService as any,
      notificationsService as any
    );
    return {
      service,
      executeQuery,
      executeMutation,
      notificationsService,
    };
  }

  async function expectHttpStatus(
    promise: Promise<unknown>,
    status: HttpStatus,
    messageFragment?: string
  ) {
    try {
      await promise;
      throw new Error('expected HttpException');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(status);
      if (messageFragment) {
        expect(error.message).toContain(messageFragment);
      }
    }
  }

  describe('requestCheck', () => {
    it('rejects non-client personas', async () => {
      const { service } = buildService({ user: businessUser });
      await expectHttpStatus(
        service.requestCheck(inventoryId),
        HttpStatus.FORBIDDEN,
        'Only clients'
      );
    });

    it('rejects when available stock is above the low-stock threshold', async () => {
      const { service } = buildService({
        inventory: {
          ...inventoryRow,
          computed_available_quantity: LOW_STOCK_THRESHOLD + 1,
        },
      });
      await expectHttpStatus(
        service.requestCheck(inventoryId),
        HttpStatus.BAD_REQUEST,
        'low'
      );
    });

    it('rejects when available stock is zero', async () => {
      const { service } = buildService({
        inventory: { ...inventoryRow, computed_available_quantity: 0 },
      });
      await expectHttpStatus(
        service.requestCheck(inventoryId),
        HttpStatus.BAD_REQUEST,
        'low'
      );
    });

    it('creates a pending check for low stock and notifies the business', async () => {
      const { service, executeMutation, notificationsService } = buildService();
      await expect(service.requestCheck(inventoryId)).resolves.toEqual({
        messageId,
      });
      expect(executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('InsertStockAvail'),
        expect.objectContaining({
          entity_id: inventoryId,
          message_payload: expect.objectContaining({
            status: 'pending',
            clientUserId,
            quantityAtRequest: 3,
          }),
        })
      );
      expect(
        notificationsService.sendStockAvailabilityCheckPush
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUserId: businessUserId,
          messageId,
          itemName: 'Widget',
          clientName: 'Sam Shopper',
        })
      );
    });

    it('conflicts when the client already has a pending check', async () => {
      const { service } = buildService({
        recentMessages: [
          { id: 'old-msg', message_payload: { ...pendingPayload } },
        ],
      });
      await expectHttpStatus(
        service.requestCheck(inventoryId),
        HttpStatus.CONFLICT,
        'pending'
      );
    });

    it('rate-limits when the client recently completed a check', async () => {
      const { service } = buildService({
        recentMessages: [
          {
            id: 'old-msg',
            message_payload: { ...pendingPayload, status: 'confirmed' },
          },
        ],
      });
      await expectHttpStatus(
        service.requestCheck(inventoryId),
        HttpStatus.TOO_MANY_REQUESTS,
        'wait'
      );
    });
  });

  describe('getCheck', () => {
    it('rejects non-business personas', async () => {
      const { service } = buildService({ user: clientUser });
      await expectHttpStatus(
        service.getCheck(messageId),
        HttpStatus.FORBIDDEN,
        'Business only'
      );
    });

    it('rejects checks owned by another business', async () => {
      const { service } = buildService({
        user: { ...businessUser, business: { id: 'other-biz' } },
      });
      await expectHttpStatus(
        service.getCheck(messageId),
        HttpStatus.FORBIDDEN,
        'Forbidden'
      );
    });

    it('prefers image_type main over the first gallery image', async () => {
      const { service } = buildService({ user: businessUser });
      const dto = await service.getCheck(messageId);
      expect(dto.itemImageUrl).toBe('https://cdn.example/main.jpg');
      expect(dto.itemName).toBe('Widget');
      expect(dto.clientName).toBe('Sam Shopper');
      expect(dto.currentAvailable).toBe(3);
    });

    it('falls back to the first image when no main image_type exists', async () => {
      const { service } = buildService({
        user: businessUser,
        inventory: {
          ...inventoryRow,
          item: {
            ...inventoryRow.item,
            item_images: [
              {
                image_url: 'https://cdn.example/only.jpg',
                image_type: 'gallery',
              },
            ],
          },
        },
      });
      const dto = await service.getCheck(messageId);
      expect(dto.itemImageUrl).toBe('https://cdn.example/only.jpg');
    });
  });

  describe('respond', () => {
    it('rejects responses when the check is no longer pending', async () => {
      const { service } = buildService({
        user: businessUser,
        message: {
          id: messageId,
          message_type: 'STOCK_AVAILABILITY',
          entity_type: 'business_inventory',
          message_payload: { ...pendingPayload, status: 'confirmed' },
        },
      });
      await expectHttpStatus(
        service.respond(messageId, { action: 'confirm' }),
        HttpStatus.CONFLICT,
        'already answered'
      );
    });

    it('confirms availability without mutating inventory quantity', async () => {
      const { service, executeMutation, notificationsService } = buildService({
        user: businessUser,
      });
      const dto = await service.respond(messageId, { action: 'confirm' });
      expect(dto.status).toBe('confirmed');
      expect(dto.quantityAfterResponse).toBe(3);
      expect(executeMutation).not.toHaveBeenCalledWith(
        expect.stringContaining('SetStockQty'),
        expect.anything()
      );
      expect(
        notificationsService.sendStockAvailabilityResultPush
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientUserId: clientUserId,
          status: 'confirmed',
        })
      );
    });

    it('marks stock unavailable', async () => {
      const { service } = buildService({ user: businessUser });
      const dto = await service.respond(messageId, { action: 'unavailable' });
      expect(dto.status).toBe('unavailable');
      expect(dto.quantityAfterResponse).toBeUndefined();
    });

    it('requires a non-negative quantity for adjust', async () => {
      const { service } = buildService({ user: businessUser });
      await expectHttpStatus(
        service.respond(messageId, { action: 'adjust' }),
        HttpStatus.BAD_REQUEST,
        'quantity'
      );
    });

    it('adjusts inventory quantity and returns available stock after reserved', async () => {
      const adjustedInventory = {
        ...inventoryRow,
        quantity: 10,
        reserved_quantity: 1,
        computed_available_quantity: 9,
      };
      const { service, executeMutation, executeQuery } = buildService({
        user: businessUser,
      });
      executeQuery.mockImplementation(async (query: string) => {
        if (query.includes('StockAvailInv')) {
          return { business_inventory_by_pk: adjustedInventory };
        }
        if (query.includes('StockAvailMsg')) {
          return {
            user_messages_by_pk: {
              id: messageId,
              message_type: 'STOCK_AVAILABILITY',
              entity_type: 'business_inventory',
              message_payload: pendingPayload,
            },
          };
        }
        if (query.includes('StockAvailUser')) {
          return {
            users_by_pk: { first_name: 'Sam', last_name: 'Shopper' },
          };
        }
        return {};
      });

      const dto = await service.respond(messageId, {
        action: 'adjust',
        quantity: 10.9,
      });

      expect(executeMutation).toHaveBeenCalledWith(
        expect.stringContaining('SetStockQty'),
        expect.objectContaining({
          id: inventoryId,
          updates: { quantity: 11 },
        })
      );
      expect(dto.status).toBe('adjusted');
      expect(dto.quantityAfterResponse).toBe(10);
    });

    it('treats concurrent pending updates as already answered', async () => {
      const { service } = buildService({
        user: businessUser,
        updateAffectedRows: 0,
      });
      await expectHttpStatus(
        service.respond(messageId, { action: 'confirm' }),
        HttpStatus.CONFLICT,
        'already answered'
      );
    });
  });
});

describe('StockAvailabilityService adjust claim ordering', () => {
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
      user_type_id: 'business', active_persona: 'business',
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
      user_type_id: 'business', active_persona: 'business',
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
