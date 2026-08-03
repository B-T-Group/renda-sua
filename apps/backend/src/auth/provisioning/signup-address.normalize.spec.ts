import {
  normalizeSignupAddress,
} from './signup-address.normalize';

describe('normalizeSignupAddress', () => {
  it('prefers store_location + country over legacy address', () => {
    const result = normalizeSignupAddress({
      country: 'ca',
      store_location: {
        street: '1 Main',
        city: 'Montreal',
        region: 'Quebec',
        postal_code: 'H2X1Y4',
      },
      address: {
        address_line_1: 'old',
        country: 'CM',
        city: 'Douala',
        state: 'Littoral',
      },
    });
    expect(result).toEqual({
      address_line_1: '1 Main',
      country: 'CA',
      city: 'Montreal',
      state: 'Quebec',
      postal_code: 'H2X1Y4',
      latitude: undefined,
      longitude: undefined,
      countryOnly: false,
    });
  });

  it('maps legacy address and detects country-only', () => {
    expect(
      normalizeSignupAddress({
        address: {
          address_line_1: '',
          country: 'cm',
          city: '',
          state: '',
        },
      })
    ).toEqual(
      expect.objectContaining({
        country: 'CM',
        countryOnly: true,
      })
    );
  });

  it('builds country-only from country field alone', () => {
    expect(normalizeSignupAddress({ country: 'GA' })).toEqual({
      address_line_1: '',
      country: 'GA',
      city: '',
      state: '',
      postal_code: '',
      countryOnly: true,
    });
  });

  it('returns undefined when store_location is present without country', () => {
    expect(
      normalizeSignupAddress({
        store_location: {
          street: '1 Main',
          city: 'Montreal',
          region: 'Quebec',
        },
      })
    ).toBeUndefined();
  });

  it('uses legacy address.country when store_location has no top-level country', () => {
    expect(
      normalizeSignupAddress({
        store_location: {
          street: '1 Main',
          city: 'Montreal',
          region: 'Quebec',
          postal_code: 'H2X1Y4',
        },
        address: {
          address_line_1: '',
          country: 'ca',
          city: '',
          state: '',
        },
      })
    ).toEqual(
      expect.objectContaining({
        address_line_1: '1 Main',
        country: 'CA',
        city: 'Montreal',
        state: 'Quebec',
        postal_code: 'H2X1Y4',
        countryOnly: false,
      })
    );
  });

  it('returns undefined when nothing provided', () => {
    expect(normalizeSignupAddress({})).toBeUndefined();
  });
});
