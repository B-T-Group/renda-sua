import { AddressGeocodeCronService } from './address-geocode-cron.service';

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
});
