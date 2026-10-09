import { HttpException, HttpStatus } from '@nestjs/common';
import {
  CurrentLocationAddressService,
  DAILY_CREATE_CAP,
} from './current-location-address.service';

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

  function build(
    rows: any[],
    created?: any,
    opts: { persona?: string; createdToday?: number; locks?: any } = {}
  ) {
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
    const getUser = jest.fn(async () => ({
      id: 'user-1',
      active_persona: opts.persona ?? 'client',
      client: { id: 'c1' },
      agent: { id: 'a1' },
      business: { id: 'b1' },
    }));
    const systemQuery = jest.fn(async () => ({
      client_addresses: Array.from({ length: opts.createdToday ?? 0 }, (_, i) => ({ id: `a${i}` })),
    }));
    const release = jest.fn(async () => undefined);
    const acquire = jest.fn(async () => release);
    const locks = opts.locks ?? { acquire };
    const service = new CurrentLocationAddressService(
      { executeQuery, getUser } as any,
      { reverseGeocode } as any,
      { createAddress } as any,
      { executeQuery: systemQuery } as any,
      locks
    );
    return { service, createAddress, reverseGeocode, executeQuery, systemQuery, acquire, release };
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

  it('M3: maps every provider failure to the fixed 400, never provider text', async () => {
    for (const failure of [
      new Error('timeout'),
      new HttpException('You have exceeded your daily request quota', HttpStatus.BAD_REQUEST),
      new HttpException('The provided API key is invalid', HttpStatus.TOO_MANY_REQUESTS),
      new HttpException('No geocoding results found', HttpStatus.NOT_FOUND),
    ]) {
      const t = build([]);
      t.reverseGeocode.mockRejectedValue(failure);
      const error = await rejection(() => t.service.resolve(3.848, 11.502));
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(error.getResponse()).toEqual({
        success: false,
        error: 'Could not resolve the current location',
      });
      expect(t.createAddress).not.toHaveBeenCalled();
    }
  });

  it('M2: geocodes a point rounded to 4 decimals but saves the exact coordinates', async () => {
    const { service, reverseGeocode, createAddress } = build([]);

    await service.resolve(3.848123456, 11.502987654);

    expect(reverseGeocode).toHaveBeenCalledWith(3.8481, 11.503);
    expect(createAddress).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 3.848123456, longitude: 11.502987654 })
    );
  });

  it('M2: stops creating new addresses once the 24h cap is reached, but still reuses', async () => {
    const capped = build([], undefined, { createdToday: DAILY_CREATE_CAP });
    const error = await rejection(() => capped.service.resolve(3.848, 11.502));
    expect(error.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect(capped.reverseGeocode).not.toHaveBeenCalled();
    expect(capped.createAddress).not.toHaveBeenCalled();

    const under = build([], undefined, { createdToday: DAILY_CREATE_CAP - 1 });
    await expect(under.service.resolve(3.848, 11.502)).resolves.toMatchObject({ reused: false });

    const reuse = build([here], undefined, { createdToday: DAILY_CREATE_CAP });
    await expect(reuse.service.resolve(3.848, 11.502)).resolves.toMatchObject({ reused: true });
    expect(reuse.systemQuery).not.toHaveBeenCalled();
  });

  it('A9: agent and business personas get 403 before any lookup or Google call', async () => {
    for (const persona of ['agent', 'business']) {
      const t = build([], undefined, { persona });
      const error = await rejection(() => t.service.resolve(3.848, 11.502));
      expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
      expect(t.executeQuery).not.toHaveBeenCalled();
      expect(t.reverseGeocode).not.toHaveBeenCalled();
      expect(t.acquire).not.toHaveBeenCalled();
    }
  });

  it('M1: takes a per-user lock around read + create and always releases it', async () => {
    const t = build([]);
    await t.service.resolve(3.848, 11.502);
    expect(t.acquire).toHaveBeenCalledWith('current-location:user-1', expect.any(Number), expect.any(Number));
    expect(t.release).toHaveBeenCalledTimes(1);

    const failing = build([]);
    failing.reverseGeocode.mockRejectedValue(new Error('x'));
    await expect(failing.service.resolve(3.848, 11.502)).rejects.toBeInstanceOf(HttpException);
    expect(failing.release).toHaveBeenCalledTimes(1);
  });

  it('M1: 6 parallel identical requests create exactly one address', async () => {
    // Real in-process lock + a store that only shows an address after createAddress ran.
    const { DistributedLockService } = await import('../common/distributed-lock.service');
    const locks = new DistributedLockService({ get: () => undefined } as never);
    const stored: any[] = [];
    const executeQuery = jest.fn(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return { client_addresses: stored.map((address) => ({ address })) };
    });
    const createAddress = jest.fn(async (input: any) => {
      await new Promise((r) => setTimeout(r, 20));
      const address = { id: `addr-${stored.length + 1}`, ...input };
      stored.push(address);
      return { address };
    });
    const service = new CurrentLocationAddressService(
      { executeQuery, getUser: async () => ({ id: 'user-1', active_persona: 'client', client: { id: 'c1' } }) } as any,
      {
        reverseGeocode: jest.fn(async () => ({
          address_line_1: '5 Rue Neuve', city: 'Yaoundé', state: 'Centre',
          country: 'Cameroon', country_code: 'CM', formatted_address: '', postal_code: '',
        })),
      } as any,
      { createAddress } as any,
      { executeQuery: jest.fn(async () => ({ client_addresses: [] })) } as any,
      locks
    );

    const results = await Promise.all(
      Array.from({ length: 6 }, () => service.resolve(3.848, 11.502))
    );

    expect(createAddress).toHaveBeenCalledTimes(1);
    expect(stored).toHaveLength(1);
    expect(results.filter((r) => !r.reused)).toHaveLength(1);
    expect(results.filter((r) => r.reused)).toHaveLength(5);
  });

  it('M1: answers 409 when the per-user lock cannot be taken in time', async () => {
    const t = build([], undefined, { locks: { acquire: jest.fn(async () => null) } });
    const error = await rejection(() => t.service.resolve(3.848, 11.502));
    expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(t.reverseGeocode).not.toHaveBeenCalled();
  });

  it('L4: uses the formatted address when there is no street, state falls back to the city', async () => {
    const { service, createAddress, reverseGeocode } = build([]);
    reverseGeocode.mockResolvedValue({
      formatted_address: '  Yaoundé, Cameroon  ',
      address_line_1: '   ',
      city: 'Yaoundé',
      state: '',
      country: 'Cameroon',
      country_code: 'CM',
      postal_code: '',
    });

    await service.resolve(3.848, 11.502);

    expect(createAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        address_line_1: 'Yaoundé, Cameroon',
        city: 'Yaoundé',
        state: 'Yaoundé',
        country: 'CM',
      })
    );
  });

  it('L4: never saves "Unknown" / "Current location" placeholders: no city or no text is a 400', async () => {
    for (const geo of [
      { formatted_address: 'Somewhere', address_line_1: 'Somewhere', city: '', state: '', country: 'Cameroon', country_code: 'CM' },
      { formatted_address: '  ', address_line_1: '', city: 'Douala', state: '', country: 'Cameroon', country_code: 'CM' },
    ]) {
      const t = build([]);
      t.reverseGeocode.mockResolvedValue(geo as any);
      const error = await rejection(() => t.service.resolve(4.05, 9.7));
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(t.createAddress).not.toHaveBeenCalled();
    }
  });
});
