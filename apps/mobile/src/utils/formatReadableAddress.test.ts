import { describe, expect, it } from 'vitest';
import { formatReadableAddress } from './formatReadableAddress';

describe('formatReadableAddress', () => {
  it('shows a geocoded line once, split into street and locality', () => {
    expect(
      formatReadableAddress(
        {
          address_line_1: "3810 Rue Magnan, L'Assomption, QC J5W 0L1, Canada",
          city: "L'Assomption",
          state: 'Quebec',
          postal_code: 'J5W 0L1',
          country: 'CA',
        },
        'en-US'
      )
    ).toBe("3810 Rue Magnan\nL'Assomption, QC J5W 0L1, Canada");
  });

  it('composes a street with city, region, and country', () => {
    expect(
      formatReadableAddress(
        {
          address_line_1: '12 Avenue Charles',
          city: 'Libreville',
          state: 'Estuaire',
          country: 'GA',
        },
        'en-US'
      )
    ).toBe('12 Avenue Charles\nLibreville, Estuaire\nGabon');
  });

  it('keeps a second line that is not already in the street', () => {
    expect(
      formatReadableAddress({
        address_line_1: '12 Avenue Charles',
        address_line_2: 'Apartment 4',
        city: 'Libreville',
      })
    ).toBe('12 Avenue Charles\nApartment 4\nLibreville');
  });

  it('returns null when nothing is set', () => {
    expect(formatReadableAddress(null)).toBeNull();
    expect(formatReadableAddress({})).toBeNull();
  });
});
