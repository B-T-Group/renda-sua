import { CurrentLocationAddressService } from './current-location-address.service';

describe('CurrentLocationAddressService', () => {
  const here = {
    id: 'addr-near',
    address_line_1: '12 Main',
    city: 'Yaoundé',
    state: 'Centre',
    postal_code: '',
    country: 'CM',
    latitude: 3.848,
    longitude: 11.502,
  };

  function build(rows: any[], created?: any) {
    const executeQuery = jest.fn(async () => ({
      client_addresses: rows.map((address) => ({ address })),
    }));
    const reverseGeocode = jest.fn(async () => ({
      formatted_address: '5 Rue Neuve, Yaoundé',
      address_line_1: '5 Rue Neuve',
      city: 'Yaoundé',
      state: 'Centre',
      country: 'Cameroon',
      country_code: 'CM',
      postal_code: '',
    }));
    const createAddress = jest.fn(async () => ({
      address: created ?? { id: 'addr-new', address_type: 'current_location' },
    }));
    const service = new CurrentLocationAddressService(
      { executeQuery } as any,
      { reverseGeocode } as any,
      { createAddress } as any
    );
    return { service, createAddress, reverseGeocode };
  }

  it('reuses a client address within 75 meters', async () => {
    const { service, createAddress } = build([here]);

    const result = await service.resolve(3.8482, 11.5021);

    expect(result.reused).toBe(true);
    expect(result.address.id).toBe('addr-near');
    expect(createAddress).not.toHaveBeenCalled();
  });

  it('reverse geocodes and creates a current_location address', async () => {
    const far = { ...here, id: 'addr-far', latitude: 4.05, longitude: 9.7 };
    const { service, createAddress, reverseGeocode } = build([far]);

    const result = await service.resolve(3.848, 11.502);

    expect(reverseGeocode).toHaveBeenCalledWith(3.848, 11.502);
    expect(createAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        address_line_1: '5 Rue Neuve',
        address_type: 'current_location',
        is_primary: false,
        latitude: 3.848,
        longitude: 11.502,
        country: 'CM',
      })
    );
    expect(result.reused).toBe(false);
    expect(result.address.id).toBe('addr-new');
  });
});
