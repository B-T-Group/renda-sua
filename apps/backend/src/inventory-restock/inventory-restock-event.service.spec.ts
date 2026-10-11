import { Test, TestingModule } from '@nestjs/testing';
import { InventoryRestockEventService } from './inventory-restock-event.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { Logger } from '@nestjs/common';

describe('InventoryRestockEventService', () => {
  let service: InventoryRestockEventService;
  let hasura: jest.Mocked<HasuraSystemService>;

  const mockExecuteQuery = jest.fn();
  const mockExecuteMutation = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryRestockEventService,
        {
          provide: HasuraSystemService,
          useValue: {
            executeQuery: mockExecuteQuery,
            executeMutation: mockExecuteMutation,
          },
        },
      ],
    }).compile();

    service = module.get<InventoryRestockEventService>(InventoryRestockEventService);
    hasura = module.get(HasuraSystemService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  describe('AC-0: Fire-and-forget / Never blocks inventory writes', () => {
    it('should not throw if Hasura mutation fails', async () => {
      mockExecuteQuery.mockResolvedValue({
        business_inventory_by_pk: {
          id: 'inv-1',
          item_id: 'item-1',
          business_location_id: 'loc-1',
          quantity: 5,
          reserved_quantity: 0,
          item: {
            status: 'approved',
            is_active: true,
            item_sub_category: { id: 'cat-1' },
          },
          business_location: {
            market_state: { market_id: 'market-1' },
          },
        },
      });

      mockExecuteMutation.mockRejectedValue(new Error('Database connection failed'));

      // Should not throw even if event emission fails
      await expect(
        service.emitRestockEventIfApplicable({
          inventoryId: 'inv-1',
          itemId: 'item-1',
          businessLocationId: 'loc-1',
          previousAvailableQuantity: 0,
          newTotalQuantity: 5,
          newReservedQuantity: 0,
        })
      ).resolves.not.toThrow();
    });

    it('should not throw if Hasura query fails', async () => {
      mockExecuteQuery.mockRejectedValue(new Error('Query timeout'));

      // Should not throw even if verification query fails
      await expect(
        service.emitRestockEventIfApplicable({
          inventoryId: 'inv-1',
          itemId: 'item-1',
          businessLocationId: 'loc-1',
          previousAvailableQuantity: 0,
          newTotalQuantity: 5,
          newReservedQuantity: 0,
        })
      ).resolves.not.toThrow();
    });

    it('should emit event only on 0 to >=1 transition', async () => {
      mockExecuteQuery.mockResolvedValue({
        business_inventory_by_pk: {
          id: 'inv-1',
          item_id: 'item-1',
          business_location_id: 'loc-1',
          quantity: 5,
          reserved_quantity: 0,
          item: {
            status: 'approved',
            is_active: true,
            item_sub_category: { id: 'cat-1' },
          },
          business_location: {
            market_state: { market_id: 'market-1' },
          },
        },
      });

      mockExecuteMutation.mockResolvedValue({});

      await service.emitRestockEventIfApplicable({
        inventoryId: 'inv-1',
        itemId: 'item-1',
        businessLocationId: 'loc-1',
        previousAvailableQuantity: 0, // Was zero
        newTotalQuantity: 5,
        newReservedQuantity: 0, // Now available = 5
      });

      expect(mockExecuteMutation).toHaveBeenCalledWith(
        expect.stringContaining('insert_restock_events_one'),
        expect.objectContaining({
          object: expect.objectContaining({
            item_id: 'item-1',
            business_location_id: 'loc-1',
          }),
        })
      );
    });

    it('should not emit event on 1 to 5 transition (not from zero)', async () => {
      mockExecuteQuery.mockResolvedValue({
        business_inventory_by_pk: {
          id: 'inv-1',
          item_id: 'item-1',
          business_location_id: 'loc-1',
          quantity: 5,
          reserved_quantity: 0,
          item: {
            status: 'approved',
            is_active: true,
            item_sub_category: { id: 'cat-1' },
          },
          business_location: {
            market_state: { market_id: 'market-1' },
          },
        },
      });

      await service.emitRestockEventIfApplicable({
        inventoryId: 'inv-1',
        itemId: 'item-1',
        businessLocationId: 'loc-1',
        previousAvailableQuantity: 1, // Was NOT zero
        newTotalQuantity: 5,
        newReservedQuantity: 0,
      });

      expect(mockExecuteMutation).not.toHaveBeenCalled();
    });

    it('should not emit event if item is inactive', async () => {
      mockExecuteQuery.mockResolvedValue({
        business_inventory_by_pk: {
          id: 'inv-1',
          item_id: 'item-1',
          business_location_id: 'loc-1',
          quantity: 5,
          reserved_quantity: 0,
          item: {
            status: 'approved',
            is_active: false, // Inactive
            item_sub_category: { id: 'cat-1' },
          },
          business_location: {
            market_state: { market_id: 'market-1' },
          },
        },
      });

      await service.emitRestockEventIfApplicable({
        inventoryId: 'inv-1',
        itemId: 'item-1',
        businessLocationId: 'loc-1',
        previousAvailableQuantity: 0,
        newTotalQuantity: 5,
        newReservedQuantity: 0,
      });

      expect(mockExecuteMutation).not.toHaveBeenCalled();
    });

    it('should not emit event if item status is not approved', async () => {
      mockExecuteQuery.mockResolvedValue({
        business_inventory_by_pk: {
          id: 'inv-1',
          item_id: 'item-1',
          business_location_id: 'loc-1',
          quantity: 5,
          reserved_quantity: 0,
          item: {
            status: 'pending', // Not approved
            is_active: true,
            item_sub_category: { id: 'cat-1' },
          },
          business_location: {
            market_state: { market_id: 'market-1' },
          },
        },
      });

      await service.emitRestockEventIfApplicable({
        inventoryId: 'inv-1',
        itemId: 'item-1',
        businessLocationId: 'loc-1',
        previousAvailableQuantity: 0,
        newTotalQuantity: 5,
        newReservedQuantity: 0,
      });

      expect(mockExecuteMutation).not.toHaveBeenCalled();
    });

    it('should not emit event if location has no market', async () => {
      mockExecuteQuery.mockResolvedValue({
        business_inventory_by_pk: {
          id: 'inv-1',
          item_id: 'item-1',
          business_location_id: 'loc-1',
          quantity: 5,
          reserved_quantity: 0,
          item: {
            status: 'approved',
            is_active: true,
            item_sub_category: { id: 'cat-1' },
          },
          business_location: {
            market_state: null, // No market
          },
        },
      });

      await service.emitRestockEventIfApplicable({
        inventoryId: 'inv-1',
        itemId: 'item-1',
        businessLocationId: 'loc-1',
        previousAvailableQuantity: 0,
        newTotalQuantity: 5,
        newReservedQuantity: 0,
      });

      expect(mockExecuteMutation).not.toHaveBeenCalled();
    });

    it('should update last_restocked_at timestamp', async () => {
      mockExecuteQuery.mockResolvedValue({
        business_inventory_by_pk: {
          id: 'inv-1',
          item_id: 'item-1',
          business_location_id: 'loc-1',
          quantity: 5,
          reserved_quantity: 0,
          item: {
            status: 'approved',
            is_active: true,
            item_sub_category: { id: 'cat-1' },
          },
          business_location: {
            market_state: { market_id: 'market-1' },
          },
        },
      });

      mockExecuteMutation.mockResolvedValue({});

      await service.emitRestockEventIfApplicable({
        inventoryId: 'inv-1',
        itemId: 'item-1',
        businessLocationId: 'loc-1',
        previousAvailableQuantity: 0,
        newTotalQuantity: 5,
        newReservedQuantity: 0,
      });

      // Should update last_restocked_at
      expect(mockExecuteMutation).toHaveBeenCalledWith(
        expect.stringContaining('update_business_inventory_by_pk'),
        expect.objectContaining({
          id: 'inv-1',
          updates: expect.objectContaining({
            last_restocked_at: expect.any(String),
          }),
        })
      );
    });
  });

  describe('emitRestockEventAfterUpdate helper', () => {
    it('should query inventory and emit if applicable', async () => {
      mockExecuteQuery.mockResolvedValue({
        business_inventory_by_pk: {
          id: 'inv-1',
          item_id: 'item-1',
          business_location_id: 'loc-1',
          quantity: 10,
          reserved_quantity: 0,
          item: {
            status: 'approved',
            is_active: true,
            item_sub_category: { id: 'cat-1' },
          },
          business_location: {
            market_state: { market_id: 'market-1' },
          },
        },
      });

      mockExecuteMutation.mockResolvedValue({});

      await service.emitRestockEventAfterUpdate('inv-1', 10, 0);

      // Should have queried the inventory
      expect(mockExecuteQuery).toHaveBeenCalledWith(
        expect.stringContaining('business_inventory_by_pk'),
        expect.objectContaining({ inventoryId: 'inv-1' })
      );

      // Should emit event (assuming previous quantity was 0)
      expect(mockExecuteMutation).toHaveBeenCalled();
    });

    it('should not throw if inventory not found', async () => {
      mockExecuteQuery.mockResolvedValue({
        business_inventory_by_pk: null,
      });

      await expect(
        service.emitRestockEventAfterUpdate('inv-999', 10, 0)
      ).resolves.not.toThrow();

      expect(mockExecuteMutation).not.toHaveBeenCalled();
    });
  });
});
