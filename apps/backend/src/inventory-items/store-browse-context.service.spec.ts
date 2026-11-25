import { StoreBrowseContextService } from './store-browse-context.service';

describe('StoreBrowseContextService', () => {
  const locationId = '11111111-1111-4111-8111-111111111111';

  function createService() {
    const hasuraSystemService = {
      executeQuery: jest.fn(),
    };
    const inventoryItemsService = {
      getInventoryStoreById: jest.fn(),
    };
    const variantInventory = {
      attachAvailableQuantities: jest.fn().mockResolvedValue(undefined),
    };
    const service = new StoreBrowseContextService(
      hasuraSystemService as any,
      inventoryItemsService as any,
      variantInventory as any
    );
    return { service, hasuraSystemService, inventoryItemsService };
  }

  it('returns null when the store cannot be resolved', async () => {
    const { service, inventoryItemsService, hasuraSystemService } =
      createService();
    inventoryItemsService.getInventoryStoreById.mockResolvedValue(null);

    await expect(service.getBrowseContext(locationId)).resolves.toBeNull();
    expect(hasuraSystemService.executeQuery).not.toHaveBeenCalled();
  });

  it('aggregates category counts ordered by item_count', async () => {
    const { service, inventoryItemsService, hasuraSystemService } =
      createService();
    inventoryItemsService.getInventoryStoreById.mockResolvedValue({
      business_location_id: locationId,
    });
    hasuraSystemService.executeQuery
      .mockResolvedValueOnce({
        business_inventory: [
          {
            item: {
              item_sub_category: {
                item_category: { id: 1, name: 'Electronics' },
              },
            },
          },
          {
            item: {
              item_sub_category: {
                item_category: { id: 2, name: 'Home' },
              },
            },
          },
          {
            item: {
              item_sub_category: {
                item_category: { id: 1, name: 'Electronics' },
              },
            },
          },
        ],
      })
      .mockResolvedValueOnce({ item_deals: [] })
      .mockResolvedValueOnce({ business_inventory: [] })
      .mockResolvedValueOnce({ business_inventory: [] })
      .mockResolvedValueOnce({ rating_aggregates: [] });

    const context = await service.getBrowseContext(locationId);
    expect(context?.categories).toEqual([
      { id: 1, name: 'Electronics', item_count: 2 },
      { id: 2, name: 'Home', item_count: 1 },
    ]);
  });

  it('returns empty deals when no active deals exist', async () => {
    const { service, inventoryItemsService, hasuraSystemService } =
      createService();
    inventoryItemsService.getInventoryStoreById.mockResolvedValue({
      business_location_id: locationId,
    });
    hasuraSystemService.executeQuery
      .mockResolvedValueOnce({ business_inventory: [] })
      .mockResolvedValueOnce({ item_deals: [] })
      .mockResolvedValueOnce({ business_inventory: [] });

    const context = await service.getBrowseContext(locationId);
    expect(context?.deals).toEqual([]);
  });

  it('filters collections to those with at least one listing at the store', async () => {
    const { service, inventoryItemsService, hasuraSystemService } =
      createService();
    inventoryItemsService.getInventoryStoreById.mockResolvedValue({
      business_location_id: locationId,
    });
    hasuraSystemService.executeQuery
      .mockResolvedValueOnce({ business_inventory: [] })
      .mockResolvedValueOnce({ item_deals: [] })
      .mockResolvedValueOnce({
        business_inventory: [
          {
            item_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            item: {
              item_images: [{ image_url: 'https://cdn/a.jpg' }],
              item_collections: [
                {
                  collection: {
                    id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
                    slug: 'baby-essentials',
                    name_en: 'Baby Essentials',
                    name_fr: 'Essentiels bébé',
                    description_en: null,
                    description_fr: null,
                    image_url: null,
                    is_featured: true,
                    sort_order: 1,
                  },
                },
              ],
            },
          },
        ],
      });

    const context = await service.getBrowseContext(locationId, { lang: 'en' });
    expect(context?.collections).toHaveLength(1);
    expect(context?.collections[0]).toMatchObject({
      slug: 'baby-essentials',
      name: 'Baby Essentials',
      listing_count: 1,
      preview_image_urls: ['https://cdn/a.jpg'],
    });
  });
});
