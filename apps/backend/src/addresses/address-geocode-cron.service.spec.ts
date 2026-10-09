import {
  AddressGeocodeCronService,
  countriesMatch,
} from './address-geocode-cron.service';

describe('AddressGeocodeCronService', () => {
  const row = {
    id: 'addr-1',
    address_line_1: '12 Nkolfoulou',
    city: 'Yaoundé',
    state: 'Centre',
    country: 'CM',
  };

  function build(hit: any) {
    const executeQuery = jest.fn(async () => ({ addresses: [row] }));
    const executeMutation = jest.fn(async () => ({
      update_addresses_by_pk: { id: row.id },
    }));
    const geocodeWithCountry = jest.fn(async () => hit);
    const service = new AddressGeocodeCronService(
      { executeQuery, executeMutation } as any,
      { geocodeWithCountry } as any
    );
    return { service, executeMutation, geocodeWithCountry };
  }

  function markedSet(executeMutation: jest.Mock): Record<string, unknown> {
    return executeMutation.mock.calls[0][1].set;
  }

  it('writes coordinates when the geocode country matches', async () => {
    const { service, executeMutation } = build({
      latitude: 3.84,
      longitude: 11.49,
      countryCode: 'CM',
      country: 'Cameroon',
    });

    const updated = await service.geocodePendingAddresses();

    expect(updated).toBe(1);
    expect(markedSet(executeMutation)).toEqual(
      expect.objectContaining({
        geocode_status: 'success',
        latitude: 3.84,
        longitude: 11.49,
      })
    );
  });

  it('records country_mismatch and does not write coordinates', async () => {
    const { service, executeMutation } = build({
      latitude: 45.5,
      longitude: -73.5,
      countryCode: 'CA',
      country: 'Canada',
    });

    const updated = await service.geocodePendingAddresses();

    expect(updated).toBe(0);
    const set = markedSet(executeMutation);
    expect(set.geocode_status).toBe('country_mismatch');
    expect(set.latitude).toBeUndefined();
  });

  it('records not_found when Google has no match', async () => {
    const { service, executeMutation } = build(null);

    const updated = await service.geocodePendingAddresses();

    expect(updated).toBe(0);
    expect(markedSet(executeMutation).geocode_status).toBe('not_found');
    expect(markedSet(executeMutation).geocode_attempted_at).toEqual(
      expect.any(String)
    );
  });

  it('sends line 2 and postal code and skips blank parts', async () => {
    const geocodeWithCountry = jest.fn(async () => null);
    const executeQuery = jest.fn(async () => ({
      addresses: [
        {
          ...row,
          address_line_2: 'Apt 4',
          postal_code: '00237',
          state: null,
        },
      ],
    }));
    const service = new AddressGeocodeCronService(
      { executeQuery, executeMutation: jest.fn() } as any,
      { geocodeWithCountry } as any
    );

    await service.geocodePendingAddresses();

    expect(geocodeWithCountry).toHaveBeenCalledWith(
      '12 Nkolfoulou, Apt 4, Yaoundé, 00237, CM'
    );
  });

  it('keeps geocoding the batch when one address throws', async () => {
    const executeQuery = jest.fn(async () => ({
      addresses: [row, { ...row, id: 'addr-2', country: 'Cameroon' }],
    }));
    const executeMutation = jest.fn(async () => ({
      update_addresses_by_pk: { id: 'addr-2' },
    }));
    const geocodeWithCountry = jest
      .fn()
      .mockRejectedValueOnce(new Error('google down'))
      .mockResolvedValueOnce({
        latitude: 3.86,
        longitude: 11.52,
        countryCode: 'CM',
        country: 'Cameroon',
      });
    const service = new AddressGeocodeCronService(
      { executeQuery, executeMutation } as any,
      { geocodeWithCountry } as any
    );

    await expect(service.geocodePendingAddresses()).resolves.toBe(1);
    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(executeMutation.mock.calls[0][1].id).toBe('addr-2');
    expect(executeMutation.mock.calls[0][1].set.latitude).toBe(3.86);
  });

  it('loads at most 200 rows and retries not_found only after 30 days', async () => {
    const now = Date.parse('2026-10-09T03:00:00.000Z');
    jest.spyOn(Date, 'now').mockReturnValue(now);
    const executeQuery = jest.fn(async () => ({ addresses: [] }));
    const service = new AddressGeocodeCronService(
      { executeQuery, executeMutation: jest.fn() } as any,
      { geocodeWithCountry: jest.fn() } as any
    );

    try {
      await expect(service.geocodePendingAddresses()).resolves.toBe(0);
      expect(executeQuery).toHaveBeenCalledWith(expect.any(String), {
        retryBefore: '2026-09-09T03:00:00.000Z',
        limit: 200,
      });
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('swallows a failed batch so the daily job keeps running', async () => {
    const service = new AddressGeocodeCronService(
      {
        executeQuery: jest.fn(async () => {
          throw new Error('hasura down');
        }),
      } as any,
      { geocodeWithCountry: jest.fn() } as any
    );

    await expect(service.handlePendingAddressGeocodes()).resolves.toBeUndefined();
  });
});

describe('countriesMatch', () => {
  const cameroon = { latitude: 3.8, longitude: 11.5, countryCode: 'CM', country: 'Cameroon' };

  it('matches an ISO code or the Google long name, ignoring case and space', () => {
    expect(countriesMatch(' cm ', cameroon)).toBe(true);
    expect(countriesMatch('Cameroon', cameroon)).toBe(true);
    expect(countriesMatch('  CAMEROON ', cameroon)).toBe(true);
  });

  it('does not match a blank country, a substring, or a different code', () => {
    expect(countriesMatch('', cameroon)).toBe(false);
    expect(countriesMatch('   ', cameroon)).toBe(false);
    expect(countriesMatch('Guinea', { ...cameroon, countryCode: 'PG', country: 'Papua New Guinea' })).toBe(false);
    expect(countriesMatch('CM', { ...cameroon, countryCode: 'CA', country: 'Cameroon' })).toBe(false);
    expect(countriesMatch('Cameroun', cameroon)).toBe(false);
  });

  it('does not treat a stored code as the long name when Google omits the code', () => {
    expect(countriesMatch('CM', { ...cameroon, countryCode: '' })).toBe(false);
    expect(countriesMatch('Cameroon', { ...cameroon, countryCode: '' })).toBe(true);
  });
});
