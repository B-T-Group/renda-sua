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

describe('InventoryItemsService wishlist listings', () => {
  function createService() {
    const hasuraSystem = {
      executeQuery: jest.fn().mockImplementation(async (query: string) => {
        if (query.includes('GetSupportedCountryCodes')) {
          return {
            supported_country_states: [{ country_code: 'CA' }, { country_code: 'CM' }],
          };
        }
        if (query.includes('ValidateLocationSupport')) {
          return { supported_country_states: [{ id: '1' }] };
        }
        if (query.includes('StripeCountries')) {
          return { supported_payment_systems: [{ country: 'CA' }] };
        }
        if (query.includes('LikedItemIds')) {
          return { user_item_likes: [{ item_id: 'item-liked' }] };
        }
        return {};
      }),
    };
    const hasuraUser = {
      getUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        client: { id: 'client-1' },
        addresses: [{ country: 'CA', state: 'Ontario', is_primary: true }],
      }),
      getUserId: jest.fn().mockReturnValue('user-1'),
    };
    const service = new InventoryItemsService(
      hasuraSystem as any,
      hasuraUser as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );
    return { service, hasuraSystem, hasuraUser };
  }

  it('returns [] for empty or blank catalog ids', async () => {
    const { service } = createService();
    await expect(service.getBestListingsForCatalogItemIds([])).resolves.toEqual(
      []
    );
    await expect(
      service.getBestListingsForCatalogItemIds(['', ''])
    ).resolves.toEqual([]);
  });

  it('includes OOS listings and does not apply shopper geo filters', async () => {
    const { service } = createService();
    const buildWhere = jest.spyOn(service as any, 'buildInventoryCatalogWhere');
    jest
      .spyOn(service as any, 'fetchAllCatalogInventoryRows')
      .mockResolvedValue([]);
    jest
      .spyOn(service as any, 'attachPaymentsEnabledToItemsAsync')
      .mockImplementation(async (items: unknown[]) => items);
    jest.spyOn(service as any, 'enrichWishlistListings').mockResolvedValue([]);

    await service.getBestListingsForCatalogItemIds(['item-1', 'item-1', '']);

    expect(buildWhere).toHaveBeenCalledWith({
      is_active: true,
      include_unavailable: true,
      searchItemIds: ['item-1'],
    });
    const built = await buildWhere.mock.results[0].value;
    const whereJson = JSON.stringify(built.where);
    expect(whereJson).not.toContain('"computed_available_quantity":{"_gt":0}');
    expect(whereJson).not.toContain('"country":{"_eq":"CA"}');
    expect(whereJson).toContain('"id":{"_in":["item-1"]}');
  });

  it('marks liked=false for anonymous callers', async () => {
    const { service, hasuraUser } = createService();
    hasuraUser.getUserId.mockImplementation(() => {
      throw new Error('anonymous');
    });

    const result = await (service as any).attachLikeState([
      { item_id: 'item-1', likes_count: 3 },
    ]);

    expect(result).toEqual([
      { item_id: 'item-1', likes_count: 3, liked: false },
    ]);
  });

  it('sets liked from user_item_likes for the signed-in shopper', async () => {
    const { service } = createService();

    const result = await (service as any).attachLikeState([
      { item_id: 'item-liked', likes_count: 2 },
      { item_id: 'item-other', likes_count: 0 },
    ]);

    expect(result).toEqual([
      { item_id: 'item-liked', likes_count: 2, liked: true },
      { item_id: 'item-other', likes_count: 0, liked: false },
    ]);
  });
});
