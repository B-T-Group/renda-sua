import {
  AddressGeocodeCronService,
  addressTextProblem,
  countriesMatch,
} from './address-geocode-cron.service';

const goodHit = {
  latitude: 3.84,
  longitude: 11.49,
  countryCode: 'CM',
  country: 'Cameroon',
  locationType: 'ROOFTOP',
  partialMatch: false,
  hasStreet: true,
  hasCity: true,
};

const row = {
  id: 'addr-1',
  address_line_1: '12 Nkolfoulou',
  city: 'Yaoundé',
  state: 'Centre',
  country: 'CM',
};

function make(rows: any[], geocode: jest.Mock) {
  const executeQuery = jest.fn(async () => ({ addresses: rows }));
  const executeMutation = jest.fn(async () => ({
    update_addresses_by_pk: { id: 'x' },
  }));
  const service = new AddressGeocodeCronService(
    { executeQuery, executeMutation } as any,
    { geocodeWithCountry: geocode } as any
  );
  return { service, executeQuery, executeMutation };
}

function sets(executeMutation: jest.Mock): Record<string, unknown>[] {
  return executeMutation.mock.calls.map((c) => c[1].set);
}

describe('AddressGeocodeCronService', () => {
  function build(hit: any, r = row) {
    const geocodeWithCountry = jest.fn(async () => hit);
    return { ...make([r], geocodeWithCountry), geocodeWithCountry };
  }

  it('writes coordinates for a street-level, non-partial match in the right country', async () => {
    const { service, executeMutation } = build(goodHit);

    expect(await service.geocodePendingAddresses()).toBe(1);
    expect(sets(executeMutation)[0]).toEqual(
      expect.objectContaining({
        geocode_status: 'success',
        geocode_reason: null,
        latitude: 3.84,
        longitude: 11.49,
      })
    );
  });

  it('accepts RANGE_INTERPOLATED too', async () => {
    const { service } = build({ ...goodHit, locationType: 'RANGE_INTERPOLATED' });
    expect(await service.geocodePendingAddresses()).toBe(1);
  });

  it('records country_mismatch and does not write coordinates', async () => {
    const { service, executeMutation } = build({
      ...goodHit,
      latitude: 45.5,
      longitude: -73.5,
      countryCode: 'CA',
      country: 'Canada',
    });

    expect(await service.geocodePendingAddresses()).toBe(0);
    const set = sets(executeMutation)[0];
    expect(set.geocode_status).toBe('country_mismatch');
    expect(set.latitude).toBeUndefined();
  });

  it('records not_found/no_match when Google has no match', async () => {
    const { service, executeMutation } = build(null);

    expect(await service.geocodePendingAddresses()).toBe(0);
    expect(sets(executeMutation)[0]).toEqual(
      expect.objectContaining({
        geocode_status: 'not_found',
        geocode_reason: 'no_match',
        geocode_attempted_at: expect.any(String),
      })
    );
  });

  describe('M5: low-confidence matches never become success', () => {
    it.each([
      ['partial match', { partialMatch: true }, 'partial_match'],
      ['GEOMETRIC_CENTER', { locationType: 'GEOMETRIC_CENTER' }, 'low_precision'],
      ['APPROXIMATE (city centroid)', { locationType: 'APPROXIMATE' }, 'low_precision'],
      ['missing precision', { locationType: '' }, 'low_precision'],
      ['no street component', { hasStreet: false }, 'no_street_component'],
      ['no city component', { hasCity: false }, 'no_city_component'],
    ])('%s -> not_found (%s)', async (_label, patch, reason) => {
      const { service, executeMutation } = build({ ...goodHit, ...patch });

      expect(await service.geocodePendingAddresses()).toBe(0);
      const set = sets(executeMutation)[0];
      expect(set.geocode_status).toBe('not_found');
      expect(set.geocode_reason).toBe(reason);
      expect(set.latitude).toBeUndefined();
      expect(set.longitude).toBeUndefined();
    });

    it('QA G3: a gibberish street with a real city is not_found, never a city centroid', async () => {
      // Google answers "qzxwv plmk 77, Yaoundé" with a partial, APPROXIMATE city centroid.
      const { service, executeMutation } = build(
        { ...goodHit, partialMatch: true, locationType: 'APPROXIMATE', hasStreet: false },
        { ...row, address_line_1: 'qzxwv plmk 77' }
      );

      expect(await service.geocodePendingAddresses()).toBe(0);
      expect(sets(executeMutation)[0]).toEqual(
        expect.objectContaining({ geocode_status: 'not_found' })
      );
      expect(sets(executeMutation)[0].latitude).toBeUndefined();
    });

    it.each(['asdf', 'sad', 'adfs', 'Mcan', '12', '   ', '1234 5'])(
      'QA G3: short/non-street text %j is not_found without calling Google',
      async (line) => {
        const { service, executeMutation, geocodeWithCountry } = build(goodHit, {
          ...row,
          address_line_1: line,
        });

        expect(await service.geocodePendingAddresses()).toBe(0);
        expect(geocodeWithCountry).not.toHaveBeenCalled();
        const set = sets(executeMutation)[0];
        expect(set.geocode_status).toBe('not_found');
        expect(set.geocode_reason).toMatch(/text_too_short|text_not_street/);
        expect(set.latitude).toBeUndefined();
      }
    );
  });

  it('only asks Hasura for active, client-linked addresses no order or business/agent uses', async () => {
    const { service, executeQuery } = build(goodHit);
    await service.geocodePendingAddresses();

    const query = String(executeQuery.mock.calls[0][0]).replace(/\s+/g, ' ');
    expect(query).toContain('status: { _eq: active }');
    expect(query).toContain('client_addresses: {}');
    for (const rel of ['business_addresses', 'agent_addresses', 'business_locations', 'orders']) {
      expect(query).toContain(`{ ${rel}: {} }`);
    }
    expect(query).toMatch(/_not: \{ _or: \[/);
  });

  it('sends line 2 and postal code and skips blank parts', async () => {
    const geocodeWithCountry = jest.fn(async () => null);
    const { service } = make(
      [{ ...row, address_line_2: 'Apt 4', postal_code: '00237', state: null }],
      geocodeWithCountry
    );

    await service.geocodePendingAddresses();

    expect(geocodeWithCountry).toHaveBeenCalledWith(
      '12 Nkolfoulou, Apt 4, Yaoundé, 00237, CM'
    );
  });

  it('keeps geocoding the batch when one address throws', async () => {
    const geocodeWithCountry = jest
      .fn()
      .mockRejectedValueOnce(new Error('google down'))
      .mockResolvedValueOnce(goodHit);
    const { service, executeMutation } = make(
      [row, { ...row, id: 'addr-2', country: 'Cameroon' }],
      geocodeWithCountry
    );

    await expect(service.geocodePendingAddresses()).resolves.toBe(1);
    expect(executeMutation).toHaveBeenCalledTimes(1);
    expect(executeMutation.mock.calls[0][1].id).toBe('addr-2');
  });

  it('loads at most 200 rows and retries not_found only after 30 days', async () => {
    const now = Date.parse('2026-10-09T03:00:00.000Z');
    jest.spyOn(Date, 'now').mockReturnValue(now);
    try {
      const { service, executeQuery } = make([], jest.fn());
      expect(await service.geocodePendingAddresses()).toBe(0);
      expect(executeQuery).toHaveBeenCalledWith(expect.any(String), {
        retryBefore: '2026-09-09T03:00:00.000Z',
        limit: 200,
      });
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('leaves a row unmarked when Google fails transiently, so tomorrow retries it', async () => {
    const { service, executeMutation } = make(
      [row],
      jest.fn(async () => {
        throw new Error('Geocoding failed: OVER_QUERY_LIMIT');
      })
    );

    await expect(service.geocodePendingAddresses()).resolves.toBe(0);
    expect(executeMutation).not.toHaveBeenCalled();
  });

  describe('flag + single-run guard (DB lock, no Redis)', () => {
    /** Hasura stand-in: flag row, and an atomic compare-and-set lock row. */
    function world(opts: { flag?: boolean | null; lockExpiry?: string | null } = {}) {
      const FREE = '1970-01-01T00:00:00.000Z';
      const state = { lock: (opts.lockExpiry ?? FREE) as string };
      const calls: string[] = [];
      const executeQuery = jest.fn(async (q: string) => {
        if (q.includes('AddressGeocodeCronFlag')) {
          return {
            application_configurations:
              opts.flag === null ? [] : [{ boolean_value: opts.flag ?? true }],
          };
        }
        calls.push('batch');
        return { addresses: [] };
      });
      const executeMutation = jest.fn(async (q: string, vars: any) => {
        if (q.includes('AcquireAddressGeocodeCronLock')) {
          const free = Date.parse(state.lock) < Date.parse(vars.now);
          if (free) state.lock = vars.expiry;
          calls.push('acquire');
          return { update_application_configurations: { affected_rows: free ? 1 : 0 } };
        }
        if (q.includes('ReleaseAddressGeocodeCronLock')) {
          const mine = state.lock === vars.expiry;
          if (mine) state.lock = vars.free;
          calls.push('release');
          return { update_application_configurations: { affected_rows: mine ? 1 : 0 } };
        }
        return {};
      });
      const service = new AddressGeocodeCronService(
        { executeQuery, executeMutation } as any,
        { geocodeWithCountry: jest.fn() } as any
      );
      return { service, state, calls, executeQuery, executeMutation };
    }

    it('is OFF by default: no flag row or false -> nothing runs, lock untouched', async () => {
      for (const flag of [null, false]) {
        const w = world({ flag });
        await w.service.handlePendingAddressGeocodes();
        expect(w.calls).toEqual([]);
      }
    });

    it('reads only the global active flag row', async () => {
      const w = world({ flag: true });
      await w.service.handlePendingAddressGeocodes();
      const [query, vars] = w.executeQuery.mock.calls[0] as any[];
      expect(vars).toEqual({ key: 'address_geocode_cron_enabled' });
      expect(String(query)).toContain('country_code: { _is_null: true }');
    });

    it('flag on: takes the lock, runs the batch, releases the lock', async () => {
      const w = world({ flag: true });
      await w.service.handlePendingAddressGeocodes();
      expect(w.calls).toEqual(['acquire', 'batch', 'release']);
      expect(Date.parse(w.state.lock)).toBe(0);
    });

    it('skips (no batch, no Google call) while another instance holds an unexpired lock', async () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      const w = world({ flag: true, lockExpiry: future });
      await w.service.handlePendingAddressGeocodes();
      expect(w.calls).toEqual(['acquire']);
      expect(w.state.lock).toBe(future);
    });

    it('takes over an expired lock (crashed run)', async () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      const w = world({ flag: true, lockExpiry: past });
      await w.service.handlePendingAddressGeocodes();
      expect(w.calls).toEqual(['acquire', 'batch', 'release']);
    });

    it('two instances at once: exactly one runs the batch', async () => {
      const w = world({ flag: true });
      await Promise.all([
        w.service.handlePendingAddressGeocodes(),
        w.service.handlePendingAddressGeocodes(),
      ]);
      expect(w.calls.filter((c) => c === 'batch')).toHaveLength(1);
    });

    it('releases the lock when the batch fails and never throws out of the cron', async () => {
      const w = world({ flag: true });
      w.executeQuery.mockImplementation(async (q: string) => {
        if (q.includes('AddressGeocodeCronFlag')) {
          return { application_configurations: [{ boolean_value: true }] };
        }
        throw new Error('hasura down');
      });
      await expect(w.service.handlePendingAddressGeocodes()).resolves.toBeUndefined();
      expect(Date.parse(w.state.lock)).toBe(0);
    });

    it('a flag read failure is swallowed (stays off)', async () => {
      const service = new AddressGeocodeCronService(
        {
          executeQuery: jest.fn(async () => {
            throw new Error('down');
          }),
          executeMutation: jest.fn(),
        } as any,
        { geocodeWithCountry: jest.fn() } as any
      );
      await expect(service.handlePendingAddressGeocodes()).resolves.toBeUndefined();
    });
  });
});

describe('addressTextProblem', () => {
  it('accepts a normal street line and rejects short or letterless text', () => {
    expect(addressTextProblem({ ...row })).toBeNull();
    expect(addressTextProblem({ ...row, address_line_1: 'Rue 1.234' })).toBeNull();
    expect(addressTextProblem({ ...row, address_line_1: 'abcd' })).toBe('text_too_short');
    expect(addressTextProblem({ ...row, address_line_1: '12345 67' })).toBe('text_not_street');
    expect(addressTextProblem({ ...row, city: 'x' })).toBe('text_not_street');
  });
});

describe('countriesMatch', () => {
  const cameroon = { ...goodHit };

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
