import {
  calculateDeliveryFeeFallback,
  isCfaDeliveryFallbackCountry,
} from './delivery-fee-fallback';

describe('isCfaDeliveryFallbackCountry', () => {
  it('treats the new CFA markets the same as CM and GA', () => {
    expect(isCfaDeliveryFallbackCountry('TG')).toBe(true);
    expect(isCfaDeliveryFallbackCountry(' bj ')).toBe(true);
    expect(isCfaDeliveryFallbackCountry('ci')).toBe(true);
    expect(isCfaDeliveryFallbackCountry('CG')).toBe(true);
    expect(isCfaDeliveryFallbackCountry('CM')).toBe(true);
    expect(isCfaDeliveryFallbackCountry('GA')).toBe(true);
  });

  it('rejects Stripe rails and blank codes', () => {
    expect(isCfaDeliveryFallbackCountry('CA')).toBe(false);
    expect(isCfaDeliveryFallbackCountry('US')).toBe(false);
    expect(isCfaDeliveryFallbackCountry('FR')).toBe(false);
    expect(isCfaDeliveryFallbackCountry('')).toBe(false);
    expect(isCfaDeliveryFallbackCountry(null)).toBe(false);
  });
});

describe('calculateDeliveryFeeFallback', () => {
  it('uses the CFA per-km rate and 1500 cap for Togo and Congo', () => {
    expect(
      calculateDeliveryFeeFallback({ distanceKm: 10, countryCode: 'TG' })
    ).toEqual({ baseFee: 1000, perKmFee: 1000, totalFee: 2000 });
    expect(
      calculateDeliveryFeeFallback({ distanceKm: 20, countryCode: 'CG' })
    ).toEqual({ baseFee: 1000, perKmFee: 1500, totalFee: 2500 });
  });

  it('charges the fast-delivery base on CFA markets', () => {
    expect(
      calculateDeliveryFeeFallback({
        distanceKm: 5,
        countryCode: 'BJ',
        requiresFastDelivery: true,
      })
    ).toEqual({ baseFee: 1500, perKmFee: 500, totalFee: 2000 });
  });

  it('zeroes per-km for Stripe markets and still honors the 1000 minimum', () => {
    expect(
      calculateDeliveryFeeFallback({ distanceKm: 20, countryCode: 'CA' })
    ).toEqual({ baseFee: 1000, perKmFee: 0, totalFee: 1000 });
    expect(
      calculateDeliveryFeeFallback({
        distanceKm: 1,
        countryCode: 'US',
        requiresFastDelivery: true,
      })
    ).toEqual({ baseFee: 1500, perKmFee: 0, totalFee: 1500 });
  });
});
