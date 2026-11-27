import { describe, expect, it } from 'vitest';
import { listingRentModes } from './listingRentModes';
import { fromHourlyPrice } from './dayHoursCopy';

describe('listingRentModes', () => {
  it('shows both prices unless a switch is off, and never hides both', () => {
    expect(listingRentModes({})).toEqual({ daily: true, hourly: true });
    expect(listingRentModes({ offers_daily: false })).toEqual({ daily: false, hourly: true });
    expect(listingRentModes({ offers_hourly: false })).toEqual({ daily: true, hourly: false });
    expect(listingRentModes({ offers_daily: false, offers_hourly: false })).toEqual({ daily: false, hourly: true });
  });

  it('prices an hourly-only listing from its hour rate', () => {
    expect(fromHourlyPrice(3000, 'XAF', 'en')).toBe('from\u00A03\u00A0000\u00A0FCFA\u00A0/\u00A0h');
    expect(fromHourlyPrice(3000, 'XAF', 'fr')).toBe('dès\u00A03\u00A0000\u00A0FCFA\u00A0/\u00A0h');
  });
});
