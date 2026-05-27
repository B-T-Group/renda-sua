jest.mock('../google/google-distance.service', () => ({
  GoogleDistanceService: jest.fn(),
}));
jest.mock('../hasura/hasura-system.service', () => ({
  HasuraSystemService: jest.fn(),
}));
jest.mock('../hasura/hasura-user.service', () => ({
  HasuraUserService: jest.fn(),
}));

import { AddressesService } from './addresses.service';

describe('AddressesService persona seed repair', () => {
  let service: AddressesService;
  let hasuraUserService: { getActivePersonaHeader: jest.Mock };
  let hasuraSystemService: {
    executeQuery: jest.Mock;
    executeMutation: jest.Mock;
    getAllUserAddresses: jest.Mock;
    ensureAccountForBusinessLocation: jest.Mock;
  };

  const sourceAddress = {
    id: 'source-address',
    address_line_1: '123 Main St',
    city: 'Douala',
    state: 'Littoral',
    postal_code: '',
    country: 'CM',
    is_primary: true,
  };

  beforeEach(() => {
    hasuraUserService = {
      getActivePersonaHeader: jest.fn().mockReturnValue(undefined),
    };
    hasuraSystemService = {
      executeQuery: jest.fn(),
      executeMutation: jest.fn(),
      getAllUserAddresses: jest.fn(),
      ensureAccountForBusinessLocation: jest.fn().mockResolvedValue(undefined),
    };
    service = new AddressesService(
      hasuraUserService as any,
      hasuraSystemService as any,
      {} as any
    );
  });

  it('seeds from the active persona when the target has no address', async () => {
    const user = {
      user_type_id: 'client',
      client: { id: 'client-1' },
      personas: ['client'],
    };
    const seedSpy = jest
      .spyOn(service, 'seedDefaultAddressForNewPersona')
      .mockResolvedValue(undefined);
    hasuraSystemService.getAllUserAddresses
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([sourceAddress]);

    await service.seedDefaultAddressForNewPersonaIfMissing(
      'user-1',
      'agent-1',
      'agent',
      user
    );

    expect(seedSpy).toHaveBeenCalledWith(
      'user-1',
      'agent-1',
      'agent',
      sourceAddress,
      undefined
    );
  });

  it('does not duplicate a client seed when the target already has an address', async () => {
    const seedSpy = jest.spyOn(service, 'seedDefaultAddressForNewPersona');
    hasuraSystemService.getAllUserAddresses.mockResolvedValue([sourceAddress]);

    await service.seedDefaultAddressForNewPersonaIfMissing(
      'user-1',
      'client-1',
      'client',
      { client: { id: 'client-1' }, personas: ['client'] }
    );

    expect(seedSpy).not.toHaveBeenCalled();
    expect(hasuraSystemService.executeMutation).not.toHaveBeenCalled();
  });

  it('repairs a missing business location and account for an existing address', async () => {
    hasuraSystemService.getAllUserAddresses.mockResolvedValue([sourceAddress]);
    hasuraSystemService.executeQuery.mockResolvedValue({
      business_locations: [],
    });
    hasuraSystemService.executeMutation.mockResolvedValue({
      insert_business_locations_one: { id: 'location-1' },
    });

    await service.seedDefaultAddressForNewPersonaIfMissing(
      'user-1',
      'business-1',
      'business',
      { business: { id: 'business-1' }, personas: ['business'] },
      'Shop'
    );

    expect(hasuraSystemService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('mutation CreateBusinessLocationInitial'),
      expect.objectContaining({
        businessId: 'business-1',
        addressId: 'source-address',
        name: 'Shop - Douala',
      })
    );
    expect(
      hasuraSystemService.ensureAccountForBusinessLocation
    ).toHaveBeenCalledWith('location-1');
  });
});
