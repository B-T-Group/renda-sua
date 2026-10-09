import { HttpException, HttpStatus } from '@nestjs/common';
import { CurrentLocationAddressService } from './current-location-address.service';

const EARTH_RADIUS_METERS = 6_371_000;

function northOf(latitude: number, longitude: number, meters: number) {
  const delta = (meters / EARTH_RADIUS_METERS) * (180 / Math.PI);
  return { latitude: latitude + delta, longitude };
}

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
    return { service, createAddress, reverseGeocode, executeQuery };
  }

  async function rejection(run: () => Promise<unknown>): Promise<HttpException> {
    try {
      await run();
    } catch (caught) {
      expect(caught).toBeInstanceOf(HttpException);
      return caught as HttpException;
    }
    throw new Error('expected HttpException');
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

  it('reuses an address exactly 75 meters away and creates one just past it', async () => {
    const onBoundary = build([here]);
    const edge = northOf(here.latitude, here.longitude, 75);
    const reused = await onBoundary.service.resolve(edge.latitude, edge.longitude);
    expect(reused.reused).toBe(true);
    expect(onBoundary.createAddress).not.toHaveBeenCalled();

    const past = build([here]);
    const beyond = northOf(here.latitude, here.longitude, 75.5);
    const created = await past.service.resolve(beyond.latitude, beyond.longitude);
    expect(created.reused).toBe(false);
    expect(past.createAddress).toHaveBeenCalled();
  });

  it('skips a stored coordinate that is not a number and uses the first nearby address', async () => {
    const closer = { ...here, id: 'addr-closer', latitude: 3.84801, longitude: 11.502 };
    const { service, createAddress } = build([
      { ...here, id: 'addr-bad', latitude: 'nope', longitude: 11.502 },
      here,
      closer,
    ]);

    const result = await service.resolve(3.848, 11.502);

    expect(result.address.id).toBe('addr-near');
    expect(createAddress).not.toHaveBeenCalled();
  });

  it('rejects coordinates outside the valid range before any lookup', async () => {
    const { service, executeQuery, reverseGeocode } = build([]);

    const error = await rejection(() => service.resolve(90.0001, 0));

    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(error.getResponse()).toEqual({
      success: false,
      error: 'latitude and longitude are required',
    });
    expect(executeQuery).not.toHaveBeenCalled();
    expect(reverseGeocode).not.toHaveBeenCalled();
    await expect(service.resolve(Number.NaN, 11)).rejects.toBeInstanceOf(HttpException);
    await expect(service.resolve(0, 180.0001)).rejects.toBeInstanceOf(HttpException);
  });

  it('accepts the poles and the antimeridian', async () => {
    const { service, executeQuery } = build([here]);

    await service.resolve(90, 180);
    await service.resolve(-90, -180);

    expect(executeQuery).toHaveBeenCalledTimes(2);
  });

  it('does not create an address when reverse geocoding has no country', async () => {
    const { service, reverseGeocode, createAddress } = build([]);
    reverseGeocode.mockResolvedValue({
      formatted_address: 'Ocean',
      address_line_1: '',
      city: '',
      state: '',
      country: '',
      country_code: '',
    });

    const error = await rejection(() => service.resolve(0, 0));

    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(error.getResponse()).toEqual({
      success: false,
      error: 'Could not resolve the current location',
    });
    expect(createAddress).not.toHaveBeenCalled();
  });

  it('turns a Google failure into a 400 and rethrows an HttpException', async () => {
    const network = build([]);
    network.reverseGeocode.mockRejectedValue(new Error('timeout'));
    const wrapped = await rejection(() => network.service.resolve(3.848, 11.502));
    expect(wrapped.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(network.createAddress).not.toHaveBeenCalled();

    const denied = new HttpException('quota', HttpStatus.TOO_MANY_REQUESTS);
    const quota = build([]);
    quota.reverseGeocode.mockRejectedValue(denied);
    await expect(quota.service.resolve(3.848, 11.502)).rejects.toBe(denied);
    expect(quota.createAddress).not.toHaveBeenCalled();
  });

  it('fills a missing street, city, and state from the geocode fallbacks', async () => {
    const { service, createAddress, reverseGeocode } = build([]);
    reverseGeocode.mockResolvedValue({
      formatted_address: '  Yaoundé, Cameroon  ',
      address_line_1: '   ',
      city: '',
      state: '',
      country: 'Cameroon',
      country_code: 'CM',
      postal_code: '',
    });

    await service.resolve(3.848, 11.502);

    expect(createAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        address_line_1: 'Yaoundé, Cameroon',
        city: 'Unknown',
        state: 'CM',
        country: 'CM',
        address_type: 'current_location',
        is_primary: false,
      })
    );
  });

  it('uses Current location when the geocode has no street text', async () => {
    const { service, createAddress, reverseGeocode } = build([]);
    reverseGeocode.mockResolvedValue({
      formatted_address: '  ',
      address_line_1: '',
      city: 'Douala',
      state: '',
      country: 'Cameroon',
      country_code: '',
    });

    await service.resolve(4.05, 9.7);

    expect(createAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        address_line_1: 'Current location',
        city: 'Douala',
        state: 'Douala',
        country: 'Cameroon',
      })
    );
  });
});
