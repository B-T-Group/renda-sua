import { Test, TestingModule } from '@nestjs/testing';
import { CatalogStopsService } from './catalog-stops.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';

describe('CatalogStopsService', () => {
  let service: CatalogStopsService;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;

  beforeEach(async () => {
    const mockHasuraSystemService = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogStopsService,
        {
          provide: HasuraSystemService,
          useValue: mockHasuraSystemService,
        },
      ],
    }).compile();

    service = module.get<CatalogStopsService>(CatalogStopsService);
    hasuraSystemService = module.get(HasuraSystemService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTopInCategory', () => {
    it('should return empty items array when no items found', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        business_inventory: [],
      });

      const result = await service.getTopInCategory({
        category: 'Electronics',
        country_code: 'GA',
      });

      expect(result.items).toEqual([]);
      expect(result.category_name).toBe('Electronics');
    });

    it('should apply category filter to itemWhere variable', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        business_inventory: [],
      });

      await service.getTopInCategory({
        category: 'Electronics',
        country_code: 'GA',
      });

      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          itemWhere: expect.objectContaining({
            item_sub_category: expect.objectContaining({
              item_category: expect.objectContaining({
                name: expect.objectContaining({
                  _ilike: expect.stringContaining('Electronics'),
                }),
              }),
            }),
          }),
        })
      );
    });

    it('should apply subcategory filter to itemWhere variable', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        business_inventory: [],
      });

      await service.getTopInCategory({
        category: 'Electronics',
        subcategory: 'Smartphones',
        country_code: 'GA',
      });

      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          itemWhere: expect.objectContaining({
            item_sub_category: expect.objectContaining({
              name: { _eq: 'Smartphones' },
            }),
          }),
        })
      );
    });

    it('should work without category filters', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        business_inventory: [],
      });

      const result = await service.getTopInCategory({
        country_code: 'GA',
      });

      expect(result.items).toEqual([]);
      expect(result.category_name).toBe('All');
      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          itemWhere: expect.objectContaining({
            is_active: { _eq: true },
          }),
        })
      );
    });

    it('should enrich items with ratings', async () => {
      const mockInventory = [
        {
          id: 'inv-1',
          item_id: 'item-1',
          selling_price: 100,
          item: {
            id: 'item-1',
            name: 'Test Item',
            item_sub_category: {
              item_category: { name: 'Electronics' },
            },
          },
        },
      ];

      hasuraSystemService.executeQuery
        .mockResolvedValueOnce({ business_inventory: mockInventory })
        .mockResolvedValueOnce({ rating_aggregates: [] });

      const result = await service.getTopInCategory({
        category: 'Electronics',
        country_code: 'GA',
      });

      expect(result.items.length).toBeGreaterThan(0);
      expect(result.category_name).toBe('Electronics');
    });
  });

  describe('getDeals', () => {
    it('should return empty items array when no deals found', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        item_deals: [],
      });

      const result = await service.getDeals({ country_code: 'GA' });

      expect(result.items).toEqual([]);
    });

    it('should calculate discount prices correctly', async () => {
      const mockDeals = [
        {
          id: 'deal-1',
          discount_type: 'percentage',
          discount_value: 20,
          business_inventory: {
            id: 'inv-1',
            selling_price: 100,
            item: { id: 'item-1', name: 'Test' },
          },
        },
      ];

      hasuraSystemService.executeQuery.mockResolvedValue({
        item_deals: mockDeals,
      });

      const result = await service.getDeals({ country_code: 'GA' });

      expect(result.items[0].discounted_price).toBe(80);
      expect(result.items[0].hasActiveDeal).toBe(true);
    });
  });

  describe('getEssentials', () => {
    it('should return empty collections array when none found', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        collections: [],
      });

      const result = await service.getEssentials({ country_code: 'GA' });

      expect(result.collections).toEqual([]);
    });

    it('should transform collections to CollectionSummary shape', async () => {
      const mockCollections = [
        {
          id: 'col-1',
          slug: 'essentials',
          name_en: 'Essentials',
          name_fr: 'Essentiels',
          description_en: 'Test',
          image_url: 'https://...',
          is_featured: true,
          sort_order: 1,
        },
      ];

      hasuraSystemService.executeQuery.mockResolvedValue({
        collections: mockCollections,
      });

      const result = await service.getEssentials({ country_code: 'GA' });

      expect(result.collections.length).toBe(1);
      expect(result.collections[0].slug).toBe('essentials');
    });
  });

  describe('getFeaturedStore', () => {
    it('should return empty stores array when none found', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        business_locations: [],
      });

      const result = await service.getFeaturedStore({ country_code: 'GA' });

      expect(result.stores).toEqual([]);
    });

    it('should transform locations to TopInventoryStoreRow shape', async () => {
      const mockLocations = [
        {
          id: 'loc-1',
          name: 'Test Store',
          logo_url: 'https://...',
          address: {
            country: 'GA',
            state: null,
            city: 'Libreville',
          },
          business: {
            id: 'biz-1',
            business_name: 'Test Business',
          },
          business_inventory_aggregate: {
            aggregate: { count: 50 },
          },
        },
      ];

      hasuraSystemService.executeQuery.mockResolvedValue({
        business_locations: mockLocations,
      });

      const result = await service.getFeaturedStore({ country_code: 'GA' });

      expect(result.stores.length).toBe(1);
      expect(result.stores[0].business_location_id).toBe('loc-1');
      expect(result.stores[0].item_count).toBe(50);
    });
  });

  describe('getBagComplements', () => {
    it('should return empty array when no inventory item ids provided', async () => {
      const result = await service.getBagComplements({
        inventory_item_ids: [],
        country_code: 'GA',
      });

      expect(result.items).toEqual([]);
    });

    it('should return empty array when cart items have no categories', async () => {
      hasuraSystemService.executeQuery
        .mockResolvedValueOnce({
          business_inventory: [],
        })
        .mockResolvedValueOnce({
          business_inventory: [],
        });

      const result = await service.getBagComplements({
        inventory_item_ids: ['item-1'],
        country_code: 'GA',
      });

      expect(result.items).toEqual([]);
    });

    it('should add reason_label to complement items', async () => {
      const mockCartItems = [
        {
          item: {
            item_sub_category: { item_category_id: 1 },
          },
        },
      ];

      const mockComplements = [
        {
          id: 'inv-1',
          item_id: 'item-2',
          item: { id: 'item-2', name: 'Complement' },
        },
      ];

      hasuraSystemService.executeQuery
        .mockResolvedValueOnce({ business_inventory: mockCartItems })
        .mockResolvedValueOnce({ business_inventory: mockComplements });

      const result = await service.getBagComplements({
        inventory_item_ids: ['item-1'],
        country_code: 'GA',
      });

      expect(result.items[0].reason_label).toBeDefined();
    });
  });
});
