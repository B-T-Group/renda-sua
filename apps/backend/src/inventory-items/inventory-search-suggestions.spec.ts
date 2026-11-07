jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));
jest.mock('../addresses/addresses.service', () => ({
  AddressesService: class AddressesService {},
}));
jest.mock('../merchant-lifecycle/merchant-lifecycle.service', () => ({
  MerchantLifecycleService: class MerchantLifecycleService {},
}));

import { InventoryItemsService } from './inventory-items.service';

describe('InventoryItemsService.getInventorySearchSuggestions', () => {
  function createService() {
    const executeQuery = jest.fn().mockImplementation(async (query: string) => {
      if (query.includes('ValidateLocationSupport')) {
        return { supported_country_states: [{ id: '1' }] };
      }
      if (query.includes('InventorySearchSuggestions')) {
        return { business_inventory: [] };
      }
      return {};
    });
    const service = new InventoryItemsService(
      { executeQuery } as any,
      { getUser: jest.fn().mockRejectedValue(new Error('anonymous')) } as any,
      {} as any,
      {} as any,
      {
        normalizeSearchQuery: (q: string) => q.trim(),
        isEmbeddingsSearchEnabled: () => false,
      } as any,
      {} as any
    );
    jest.spyOn(service, 'getTopInventoryStores').mockResolvedValue([]);
    return { service, executeQuery };
  }

  function suggestionQuery(executeQuery: jest.Mock): string {
    const call = executeQuery.mock.calls.find(([query]) =>
      String(query).includes('InventorySearchSuggestions')
    );
    expect(call).toBeTruthy();
    return String(call?.[0] ?? '');
  }

  it('selects item.currency and does not select businesses.currency', async () => {
    const { service, executeQuery } = createService();

    await service.getInventorySearchSuggestions({
      q: 'phone',
      country_code: 'CM',
    });

    const gql = suggestionQuery(executeQuery);
    expect(gql).toMatch(/item\s*\{[\s\S]*\bcurrency\b/);
    expect(gql).not.toMatch(/business\s*\{[\s\S]*\bcurrency\b/);
  });

  it('uses item.currency on product suggestions', async () => {
    const { service, executeQuery } = createService();
    executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('ValidateLocationSupport')) {
        return { supported_country_states: [{ id: '1' }] };
      }
      if (query.includes('InventorySearchSuggestions')) {
        return {
          business_inventory: [
            {
              id: 'inv-1',
              selling_price: 1500,
              computed_available_quantity: 3,
              item: {
                name: 'Phone case',
                currency: 'XAF',
                item_images: [],
                item_sub_category: { item_category: { name: 'Electronics' } },
                item_tags: [],
              },
              business_location: {
                id: 'loc-1',
                name: 'Shop Douala',
                logo_url: null,
                business: { id: 'biz-1', name: 'Shop' },
              },
            },
          ],
        };
      }
      return {};
    });

    const suggestions = await service.getInventorySearchSuggestions({
      q: 'phone',
      country_code: 'CM',
    });

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'product',
          inventoryId: 'inv-1',
          currency: 'XAF',
          available: true,
        }),
      ])
    );
  });

  it('adds a seller suggestion when only the store name matches', async () => {
    const { service, executeQuery } = createService();
    executeQuery.mockImplementation(async (query: string) => {
      if (query.includes('ValidateLocationSupport')) {
        return { supported_country_states: [{ id: '1' }] };
      }
      if (query.includes('InventorySearchSuggestions')) {
        return { business_inventory: [] };
      }
      return {};
    });
    jest.spyOn(service, 'getTopInventoryStores').mockResolvedValue([
      {
        business_location_id: 'loc-9',
        business_id: 'biz-9',
        name: 'Acme Market',
        city: 'Douala',
        logo_url: null,
        item_count: 12,
        is_verified: true,
        can_accept_orders: true,
        is_storefront_visible: true,
      },
    ]);

    const suggestions = await service.getInventorySearchSuggestions({
      q: 'acme',
      country_code: 'CM',
    });

    expect(suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'seller',
          businessId: 'biz-9',
          businessLocationId: 'loc-9',
          name: 'Acme Market',
        }),
      ])
    );
  });
});
