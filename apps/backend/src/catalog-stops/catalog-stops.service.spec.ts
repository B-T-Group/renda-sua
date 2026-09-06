import { Test, TestingModule } from '@nestjs/testing';
import { CatalogStopsService } from './catalog-stops.service';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import { CollectionsService } from '../collections/collections.service';

describe('CatalogStopsService', () => {
  let service: CatalogStopsService;
  let hasuraSystemService: jest.Mocked<HasuraSystemService>;
  let collectionsService: jest.Mocked<Pick<CollectionsService, 'listCollections'>>;

  beforeEach(async () => {
    const mockHasuraSystemService = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
    };
    const mockCollectionsService = {
      listCollections: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogStopsService,
        {
          provide: HasuraSystemService,
          useValue: mockHasuraSystemService,
        },
        {
          provide: CollectionsService,
          useValue: mockCollectionsService,
        },
      ],
    }).compile();

    service = module.get<CatalogStopsService>(CatalogStopsService);
    hasuraSystemService = module.get(HasuraSystemService);
    collectionsService = module.get(CollectionsService);
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

    it('should build query with locationWhere variable for country and state', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        business_inventory: [],
      });

      await service.getTopInCategory({
        category: 'Electronics',
        country_code: 'CM',
        state: 'Centre',
      });

      const [query, variables] = hasuraSystemService.executeQuery.mock.calls[0];
      
      expect(query).toContain('$locationWhere: business_locations_bool_exp!');
      expect(variables).toEqual(
        expect.objectContaining({
          locationWhere: expect.objectContaining({
            address: {
              country: { _eq: 'CM' },
              state: { _eq: 'Centre' },
            },
          }),
        })
      );
      
      // Explicitly verify SINGLE nested address object (not sibling keys)
      const locationWhere = variables.locationWhere;
      expect(locationWhere.address).toBeDefined();
      expect(locationWhere.address.country).toEqual({ _eq: 'CM' });
      expect(locationWhere.address.state).toEqual({ _eq: 'Centre' });
      expect(locationWhere.country).toBeUndefined(); // No sibling country key
      expect(locationWhere.state).toBeUndefined(); // No sibling state key
      
      // Verify business.is_storefront_visible (not location.storefront_visible)
      expect(locationWhere.business).toEqual({ is_storefront_visible: { _eq: true } });
      expect(locationWhere.storefront_visible).toBeUndefined();
      expect(locationWhere.is_storefront_visible).toBeUndefined();
    });

    it('should apply category filter to itemWhere variable', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        business_inventory: [],
      });

      await service.getTopInCategory({
        category: 'Electronics',
        country_code: 'GA',
      });

      const [query, variables] = hasuraSystemService.executeQuery.mock.calls[0];
      expect(query).toContain('$locationWhere: business_locations_bool_exp!');
      expect(query).not.toContain('country_code:');
      expect(query).not.toContain('storefront_visible:');
      expect(variables).toEqual(
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
          locationWhere: expect.objectContaining({
            is_active: { _eq: true },
            business: { is_storefront_visible: { _eq: true } },
            address: { country: { _eq: 'GA' } },
          }),
        })
      );
    });

    it('should scope by address.state when state is provided', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        business_inventory: [],
      });

      await service.getTopInCategory({
        country_code: 'CM',
        state: 'Centre',
      });

      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          locationWhere: expect.objectContaining({
            address: {
              country: { _eq: 'CM' },
              state: { _eq: 'Centre' },
            },
          }),
        })
      );
    });

    it('should require a non-null address.country when country is omitted', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        business_inventory: [],
      });

      await service.getTopInCategory({});

      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          locationWhere: expect.objectContaining({
            address: { country: { _is_null: false } },
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

    it('should include nested selection set for variant_price_overrides', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        business_inventory: [],
      });

      await service.getTopInCategory({
        category: 'Electronics',
        country_code: 'GA',
      });

      const query = hasuraSystemService.executeQuery.mock.calls[0][0] as string;
      
      // Assert that variant_price_overrides has a nested selection set, not bare field
      expect(query).toMatch(/variant_price_overrides\s*\{/);
      expect(query).toMatch(/variant_price_overrides\s*\{\s*id/);
      expect(query).toMatch(/item_variant_id/);
      expect(query).toMatch(/selling_price/);
    });
  });

  describe('getDeals', () => {
    it('should return empty items array when no deals found', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        item_deals: [],
      });

      const result = await service.getDeals({ country_code: 'GA' });

      expect(result.items).toEqual([]);
      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('$locationWhere: business_locations_bool_exp!'),
        expect.objectContaining({
          locationWhere: expect.objectContaining({
            address: { country: { _eq: 'GA' } },
          }),
        })
      );
    });

    it('should build query with locationWhere variable for country and state', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        item_deals: [],
      });

      await service.getDeals({
        country_code: 'CM',
        state: 'Centre',
      });

      const [query, variables] = hasuraSystemService.executeQuery.mock.calls[0];
      
      expect(query).toContain('$locationWhere: business_locations_bool_exp!');
      expect(variables).toEqual(
        expect.objectContaining({
          locationWhere: expect.objectContaining({
            address: {
              country: { _eq: 'CM' },
              state: { _eq: 'Centre' },
            },
          }),
        })
      );
      
      // Explicitly verify SINGLE nested address object (not sibling keys)
      const locationWhere = variables.locationWhere;
      expect(locationWhere.address).toBeDefined();
      expect(locationWhere.address.country).toEqual({ _eq: 'CM' });
      expect(locationWhere.address.state).toEqual({ _eq: 'Centre' });
      expect(locationWhere.country).toBeUndefined(); // No sibling country key
      expect(locationWhere.state).toBeUndefined(); // No sibling state key
      
      // Verify business.is_storefront_visible
      expect(locationWhere.business).toEqual({ is_storefront_visible: { _eq: true } });
      expect(locationWhere.storefront_visible).toBeUndefined();
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
      collectionsService.listCollections.mockResolvedValue([]);

      const result = await service.getEssentials({ country_code: 'GA' });

      expect(result.collections).toEqual([]);
      expect(collectionsService.listCollections).toHaveBeenCalledWith(
        expect.objectContaining({
          featured: true,
          country_code: 'GA',
        })
      );
    });

    it('should return featured collections with previews from CollectionsService', async () => {
      collectionsService.listCollections.mockResolvedValue([
        {
          id: 'col-1',
          slug: 'office-essentials',
          name: 'Office Essentials',
          description: null,
          image_url: null,
          preview_image_urls: ['https://a.jpg', 'https://b.jpg', 'https://c.jpg', 'https://d.jpg'],
          is_featured: true,
          sort_order: 1,
          listing_count: 6,
        },
      ]);

      const result = await service.getEssentials({ country_code: 'CM', state: 'Centre' });

      expect(result.collections.length).toBe(1);
      expect(result.collections[0].slug).toBe('office-essentials');
      expect(result.collections[0].preview_image_urls).toHaveLength(4);
      expect(collectionsService.listCollections).toHaveBeenCalledWith(
        expect.objectContaining({
          featured: true,
          country_code: 'CM',
          state: 'Centre',
        })
      );
    });

    it('should cap collections by limit', async () => {
      collectionsService.listCollections.mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({
          id: `col-${i}`,
          slug: `c-${i}`,
          name: `C${i}`,
          description: null,
          image_url: null,
          preview_image_urls: [],
          is_featured: true,
          sort_order: i,
          listing_count: 4,
        }))
      );

      const result = await service.getEssentials({ limit: 3 });

      expect(result.collections).toHaveLength(3);
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

    it('should build query with locationWhere variable for country and state', async () => {
      hasuraSystemService.executeQuery.mockResolvedValue({
        business_locations: [],
      });

      await service.getFeaturedStore({
        country_code: 'CM',
        state: 'Centre',
      });

      const [query, variables] = hasuraSystemService.executeQuery.mock.calls[0];
      
      expect(query).toContain('$locationWhere: business_locations_bool_exp!');
      expect(variables).toEqual(
        expect.objectContaining({
          locationWhere: expect.objectContaining({
            address: {
              country: { _eq: 'CM' },
              state: { _eq: 'Centre' },
            },
          }),
        })
      );
      
      // Explicitly verify SINGLE nested address object (not sibling keys)
      const locationWhere = variables.locationWhere;
      expect(locationWhere.address).toBeDefined();
      expect(locationWhere.address.country).toEqual({ _eq: 'CM' });
      expect(locationWhere.address.state).toEqual({ _eq: 'Centre' });
      expect(locationWhere.country).toBeUndefined(); // No sibling country key
      expect(locationWhere.state).toBeUndefined(); // No sibling state key
      
      // Verify business.is_storefront_visible
      expect(locationWhere.business).toEqual({ is_storefront_visible: { _eq: true } });
      expect(locationWhere.storefront_visible).toBeUndefined();
    });

    it('should transform locations to TopInventoryStoreRow shape', async () => {
      const mockLocations = [
        {
          id: 'loc-1',
          name: 'Test Store',
          logo_url: 'https://example.test/logo.png',
          business: {
            id: 'biz-1',
            name: 'Test Business',
            is_verified: true,
            can_accept_orders: true,
            is_storefront_visible: true,
          },
          address: { city: 'Libreville' },
          business_inventory_aggregate: {
            aggregate: { count: 50 },
          },
        },
      ];

      hasuraSystemService.executeQuery.mockResolvedValue({
        business_locations: mockLocations,
      });

      const result = await service.getFeaturedStore({ country_code: 'GA' });

      expect(hasuraSystemService.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('$locationWhere: business_locations_bool_exp!'),
        expect.objectContaining({
          locationWhere: expect.objectContaining({
            address: { country: { _eq: 'GA' } },
            business: { is_storefront_visible: { _eq: true } },
          }),
        })
      );
      expect(result.stores.length).toBe(1);
      expect(result.stores[0].business_location_id).toBe('loc-1');
      expect(result.stores[0].name).toBe('Test Store');
      expect(result.stores[0].city).toBe('Libreville');
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

    it('should build query with locationWhere variable for country and state', async () => {
      hasuraSystemService.executeQuery
        .mockResolvedValueOnce({
          business_inventory: [
            {
              item: {
                item_sub_category: { item_category_id: 1 },
              },
            },
          ],
        })
        .mockResolvedValueOnce({ business_inventory: [] });

      await service.getBagComplements({
        inventory_item_ids: ['item-1'],
        country_code: 'CM',
        state: 'Centre',
      });

      const [query, variables] = hasuraSystemService.executeQuery.mock.calls[1];
      
      expect(query).toContain('$locationWhere: business_locations_bool_exp!');
      expect(variables).toEqual(
        expect.objectContaining({
          locationWhere: expect.objectContaining({
            address: {
              country: { _eq: 'CM' },
              state: { _eq: 'Centre' },
            },
          }),
        })
      );
      
      // Explicitly verify SINGLE nested address object (not sibling keys)
      const locationWhere = variables.locationWhere;
      expect(locationWhere.address).toBeDefined();
      expect(locationWhere.address.country).toEqual({ _eq: 'CM' });
      expect(locationWhere.address.state).toEqual({ _eq: 'Centre' });
      expect(locationWhere.country).toBeUndefined(); // No sibling country key
      expect(locationWhere.state).toBeUndefined(); // No sibling state key
      
      // Verify business.is_storefront_visible
      expect(locationWhere.business).toEqual({ is_storefront_visible: { _eq: true } });
      expect(locationWhere.storefront_visible).toBeUndefined();
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
