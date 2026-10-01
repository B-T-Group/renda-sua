import {
  capDeliveryFee,
  collectedDeliveryFee,
  isBeyondFeeRange,
  maxClientDistanceKm,
  normalizeDeliveryCountryCode,
  shouldWaiveDeliveryFee,
  waivedCustomerDeliveryFee,
} from './delivery-pricing.util';

describe('delivery pricing', () => {
  it('derives 5 km from a 1000 cap, 500 base, and 100 per km', () => {
    expect(maxClientDistanceKm(500, 100, 1000)).toBe(5);
  });

  it('derives 0 km when the base equals the cap', () => {
    expect(maxClientDistanceKm(1000, 100, 1000)).toBe(0);
  });

  it('has no price-derived distance when the cap or per-km rate is unset', () => {
    expect(maxClientDistanceKm(500, 100, 0)).toBeNull();
    expect(maxClientDistanceKm(500, 0, 1000)).toBeNull();
    expect(isBeyondFeeRange(20, null)).toBe(false);
  });

  it('trims the per-km slice so the total stays at the cap', () => {
    expect(
      capDeliveryFee({
        baseFee: 500,
        perKmRate: 100,
        distanceKm: 8,
        maxDeliveryFee: 1000,
        maxPerKmFee: 1500,
      })
    ).toEqual({ baseFee: 500, perKmFee: 500, totalFee: 1000 });
  });

  it('charges base plus per km when that is under the cap', () => {
    expect(
      capDeliveryFee({
        baseFee: 500,
        perKmRate: 100,
        distanceKm: 3,
        maxDeliveryFee: 1000,
        maxPerKmFee: 1500,
      })
    ).toEqual({ baseFee: 500, perKmFee: 300, totalFee: 800 });
  });

  it('falls back to the per-km cap when the total cap is unset', () => {
    expect(
      capDeliveryFee({
        baseFee: 1000,
        perKmRate: 100,
        distanceKm: 20,
        maxDeliveryFee: 0,
        maxPerKmFee: 1500,
      })
    ).toEqual({ baseFee: 1000, perKmFee: 1500, totalFee: 2500 });
  });

  it('shrinks the base when it alone is above the total cap', () => {
    expect(
      capDeliveryFee({
        baseFee: 1800,
        perKmRate: 100,
        distanceKm: 4,
        maxDeliveryFee: 1000,
        maxPerKmFee: 1500,
      })
    ).toEqual({ baseFee: 1000, perKmFee: 0, totalFee: 1000 });
  });

  it('treats a negative distance or rate as zero', () => {
    expect(
      capDeliveryFee({
        baseFee: 500,
        perKmRate: -100,
        distanceKm: -3,
        maxDeliveryFee: 1000,
        maxPerKmFee: 1500,
      })
    ).toEqual({ baseFee: 500, perKmFee: 0, totalFee: 500 });
  });

  it('waives only inside the deduced distance at the commission threshold', () => {
    expect(
      shouldWaiveDeliveryFee({
        distanceKm: 5,
        maxClientKm: 5,
        commissionAmount: 10000,
        threshold: 10000,
      })
    ).toBe(true);
    expect(
      shouldWaiveDeliveryFee({
        distanceKm: 5.1,
        maxClientKm: 5,
        commissionAmount: 20000,
        threshold: 10000,
      })
    ).toBe(false);
    expect(
      shouldWaiveDeliveryFee({
        distanceKm: 2,
        maxClientKm: 5,
        commissionAmount: 9999,
        threshold: 10000,
      })
    ).toBe(false);
    expect(
      shouldWaiveDeliveryFee({
        distanceKm: 1,
        maxClientKm: null,
        commissionAmount: 20000,
        threshold: 10000,
      })
    ).toBe(false);
    expect(
      shouldWaiveDeliveryFee({
        distanceKm: 1,
        maxClientKm: 5,
        commissionAmount: 20000,
        threshold: 0,
      })
    ).toBe(false);
  });

  it('maps country names to the ISO codes used by delivery config', () => {
    expect(normalizeDeliveryCountryCode('Gabon')).toBe('GA');
    expect(normalizeDeliveryCountryCode('cameroon')).toBe('CM');
    expect(normalizeDeliveryCountryCode('GA')).toBe('GA');
    expect(normalizeDeliveryCountryCode("Cote d'Ivoire")).toBe('CI');
    expect(normalizeDeliveryCountryCode('Ivory Coast')).toBe('CI');
    expect(normalizeDeliveryCountryCode('')).toBe('GA');
    expect(normalizeDeliveryCountryCode('Nigeria')).toBe('NI');
  });

  it('ignores stored base and per-km when the customer delivery fee was waived', () => {
    expect(
      collectedDeliveryFee({
        base_delivery_fee: 500,
        per_km_delivery_fee: 300,
        delivery_fee_waived: true,
      })
    ).toBe(0);
    expect(
      collectedDeliveryFee({
        base_delivery_fee: 500,
        per_km_delivery_fee: 300,
        delivery_fee_waived: false,
      })
    ).toBe(800);
  });

  it('charges the customer 0 and restores the pre-waiver base, skipping the first-order promo', () => {
    expect(
      waivedCustomerDeliveryFee({
        baseDeliveryFeeBeforeDiscount: 500,
        perKmDeliveryFee: 300,
      })
    ).toEqual({
      deliveryFee: 0,
      deliveryFeeBeforeWaiver: 800,
      baseDeliveryFee: 500,
      firstOrderDeliveryFeePromo: false,
      firstOrderBaseDeliveryDiscountAmount: 0,
    });
  });
});
