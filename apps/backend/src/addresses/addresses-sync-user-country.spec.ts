import { AddressesService } from './addresses.service';

describe('AddressesService.syncUserCountry isolation', () => {
  function createService() {
    const hasuraUser = {
      getUser: jest.fn(),
      getUserId: jest.fn().mockReturnValue('user-1'),
      executeQuery: jest.fn(),
    };
    const hasuraSystem = {
      executeMutation: jest.fn(),
      executeQuery: jest.fn(),
      countLinkedAddressesForUser: jest.fn().mockResolvedValue(1),
      setUserTimezone: jest.fn(),
    };
    const service = new AddressesService(
      hasuraUser as any,
      hasuraSystem as any,
      {} as any,
      { get: jest.fn() } as any
    );
    return { service, hasuraUser, hasuraSystem };
  }

  const storeAddress = {
    address_line_1: '12 Market St',
    city: 'Douala',
    state: 'Littoral',
    country: 'cm',
    postal_code: '00000',
  };

  it('normalizes country and writes users.country for merchant sync', async () => {
    const { service, hasuraSystem } = createService();
    hasuraSystem.executeMutation.mockResolvedValue({
      update_users_by_pk: { id: 'user-1' },
    });

    await (service as any).syncUserCountry('user-1', ' cm ');

    expect(hasuraSystem.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('SyncUserCountry'),
      { id: 'user-1', country: 'CM' }
    );
  });

  it('skips blank country codes', async () => {
    const { service, hasuraSystem } = createService();

    await (service as any).syncUserCountry('user-1', '   ');
    await (service as any).syncUserCountry('user-1', null);

    expect(hasuraSystem.executeMutation).not.toHaveBeenCalled();
  });

  it('swallows sync failures so address writes still succeed', async () => {
    const { service, hasuraSystem } = createService();
    hasuraSystem.executeMutation.mockRejectedValue(new Error('hasura down'));

    await expect(
      (service as any).syncUserCountry('user-1', 'CA')
    ).resolves.toBeUndefined();
  });

  it('does not flip users.country when a shopper creates a delivery address', async () => {
    const { service, hasuraUser, hasuraSystem } = createService();
    hasuraUser.getUser.mockResolvedValue({
      id: 'user-1',
      active_persona: 'client',
      client: { id: 'client-1' },
    });
    jest
      .spyOn(service as any, 'geocodeAddress')
      .mockResolvedValue({ latitude: 4.05, longitude: 9.7 });
    jest.spyOn(service as any, 'ensureSinglePrimaryAddress').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'getCurrencyFromCountry').mockResolvedValue('XAF');
    jest.spyOn(service as any, 'checkExistingPersonalAccount').mockResolvedValue(true);
    const syncSpy = jest.spyOn(service as any, 'syncUserCountry');
    hasuraSystem.executeMutation.mockImplementation(async (mutation: string) => {
      if (mutation.includes('CreateAddress')) {
        return {
          insert_addresses_one: {
            id: 'addr-1',
            ...storeAddress,
            country: 'CM',
          },
        };
      }
      return {};
    });

    await service.createAddress({
      ...storeAddress,
      is_primary: true,
      address_type: 'home',
    });

    expect(syncSpy).not.toHaveBeenCalled();
    const mutations = hasuraSystem.executeMutation.mock.calls.map(
      ([query]) => String(query)
    );
    expect(mutations.some((q) => q.includes('SyncUserCountry'))).toBe(false);
  });

  it('syncs users.country only for a primary business location', async () => {
    const { service, hasuraUser, hasuraSystem } = createService();
    jest
      .spyOn(service as any, 'geocodeAddress')
      .mockResolvedValue({ latitude: 4.05, longitude: 9.7 });
    jest.spyOn(service as any, 'recomputeBusinessLifecycle').mockResolvedValue(undefined);
    const syncSpy = jest.spyOn(service as any, 'syncUserCountry');
    hasuraUser.executeQuery.mockResolvedValue({
      business_locations: [
        {
          id: 'loc-1',
          address_id: null,
          business_id: 'biz-1',
          is_primary: true,
        },
      ],
    });
    hasuraSystem.executeMutation.mockImplementation(async (mutation: string) => {
      if (mutation.includes('CreateAddress')) {
        return {
          insert_addresses_one: {
            id: 'addr-1',
            ...storeAddress,
            country: 'CM',
          },
        };
      }
      return {};
    });

    await service.createBusinessLocationAddress('loc-1', storeAddress);

    expect(syncSpy).toHaveBeenCalledWith('user-1', 'CM');
  });

  it('does not flip users.country when a shopper updates a primary delivery address', async () => {
    const { service, hasuraUser, hasuraSystem } = createService();
    hasuraUser.getUser.mockResolvedValue({
      id: 'user-1',
      active_persona: 'client',
      client: { id: 'client-1' },
    });
    jest.spyOn(service as any, 'getAddressesByIds').mockResolvedValue([
      { id: 'addr-1', ...storeAddress, country: 'CM', is_primary: true },
    ]);
    jest
      .spyOn(service as any, 'geocodeAddress')
      .mockResolvedValue({ latitude: 45.5, longitude: -73.6 });
    jest.spyOn(service as any, 'ensureSinglePrimaryAddress').mockResolvedValue(undefined);
    const syncSpy = jest.spyOn(service as any, 'syncUserCountry');
    const lifecycleSpy = jest
      .spyOn(service as any, 'recomputeBusinessLifecycle')
      .mockResolvedValue(undefined);
    hasuraSystem.executeQuery.mockResolvedValue({
      client_addresses: [{ id: 'link-1' }],
      agent_addresses: [],
      business_addresses: [],
    });
    hasuraSystem.executeMutation.mockResolvedValue({
      update_addresses_by_pk: {
        id: 'addr-1',
        ...storeAddress,
        country: 'CA',
        is_primary: true,
      },
    });

    await service.updateAddress('addr-1', {
      country: 'CA',
      is_primary: true,
    });

    expect(syncSpy).not.toHaveBeenCalled();
    expect(lifecycleSpy).not.toHaveBeenCalled();
    const mutations = hasuraSystem.executeMutation.mock.calls.map(
      ([query]) => String(query)
    );
    expect(mutations.some((q) => q.includes('SyncUserCountry'))).toBe(false);
  });

  it('does not sync users.country for a non-primary store location', async () => {
    const { service, hasuraUser, hasuraSystem } = createService();
    jest
      .spyOn(service as any, 'geocodeAddress')
      .mockResolvedValue({ latitude: 4.05, longitude: 9.7 });
    jest.spyOn(service as any, 'recomputeBusinessLifecycle').mockResolvedValue(undefined);
    const syncSpy = jest.spyOn(service as any, 'syncUserCountry');
    hasuraUser.executeQuery.mockResolvedValue({
      business_locations: [
        {
          id: 'loc-2',
          address_id: null,
          business_id: 'biz-1',
          is_primary: false,
        },
      ],
    });
    hasuraSystem.executeMutation.mockImplementation(async (mutation: string) => {
      if (mutation.includes('CreateAddress')) {
        return {
          insert_addresses_one: {
            id: 'addr-2',
            ...storeAddress,
            country: 'FR',
          },
        };
      }
      return {};
    });

    await service.createBusinessLocationAddress('loc-2', {
      ...storeAddress,
      country: 'FR',
    });

    expect(syncSpy).not.toHaveBeenCalled();
  });
});
