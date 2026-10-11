jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { HttpException, HttpStatus } from '@nestjs/common';
import { OrdersService } from './orders.service';

type DistanceOrigin = {
  formatAddressForDistanceMatrix: (address: Record<string, unknown>) => string;
  assertDropOffCountryMatchesSellers: (
    fulfillment: 'delivery' | 'pickup' | 'shipping',
    dropOffCountry: string | null | undefined,
    inventories: Array<{
      business_location?: {
        address?: { country?: string | null } | null;
      } | null;
    }>
  ) => void;
};

function service(): DistanceOrigin {
  return Object.create(OrdersService.prototype) as DistanceOrigin;
}

function format(address: Record<string, unknown>): string {
  return service().formatAddressForDistanceMatrix(address);
}

describe('delivery distance origin', () => {
  it('routes from coordinates, including 0,0 and the pole edges', () => {
    expect(
      format({
        latitude: 4.05,
        longitude: 9.7,
        address_line_1: 'Rue de la Joie',
        city: 'Douala',
      })
    ).toBe('4.05,9.7');
    expect(format({ latitude: 0, longitude: 0, city: 'Nowhere' })).toBe('0,0');
    expect(format({ latitude: '90', longitude: '-180', city: 'Edge' })).toBe(
      '90,-180'
    );
  });

  it('falls back to the street when coordinates are missing or out of range', () => {
    const street = {
      address_line_1: '12 Main',
      address_line_2: '',
      city: 'Libreville',
      state: null,
      postal_code: 'BP 1',
      country: 'GA',
    };
    expect(format(street)).toBe('12 Main, Libreville, BP 1, GA');
    expect(format({ ...street, latitude: 90.1, longitude: 9.7 })).toBe(
      '12 Main, Libreville, BP 1, GA'
    );
    expect(format({ ...street, latitude: 4, longitude: Number.NaN })).toBe(
      '12 Main, Libreville, BP 1, GA'
    );
    expect(format({})).toBe('');
  });

  it('rejects a drop-off outside the seller country and allows pickup', () => {
    const orders = service();
    expect(() => {
      orders.assertDropOffCountryMatchesSellers('pickup', null, [
        { business_location: { address: { country: 'CM' } } },
      ]);
    }).not.toThrow();
    expect(() =>
      orders.assertDropOffCountryMatchesSellers('delivery', ' ga ', [
        { business_location: { address: { country: 'GA' } } },
      ])
    ).not.toThrow();

    try {
      orders.assertDropOffCountryMatchesSellers('shipping', null, [
        { business_location: { address: { country: 'GA' } } },
      ]);
      throw new Error('expected a missing-country rejection');
    } catch (error: any) {
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(error.getResponse()).toMatchObject({
        error: 'DELIVERY_COUNTRY_MISMATCH',
        message: 'A delivery address in the seller country is required.',
      });
    }
  });

  it('names the first seller country that does not match the drop-off', () => {
    const orders = service();
    try {
      orders.assertDropOffCountryMatchesSellers('delivery', 'GA', [
        { business_location: { address: { country: 'GA' } } },
        { business_location: { address: { country: 'cm' } } },
        { business_location: { address: { country: 'Cameroon' } } },
      ]);
      throw new Error('expected a country mismatch');
    } catch (error: any) {
      expect(error.getResponse().message).toContain('in GA');
      expect(error.getResponse().message).toContain('within CM');
    }

    expect(() =>
      orders.assertDropOffCountryMatchesSellers('delivery', 'CA', [
        { business_location: { address: { country: 'Cameroon' } } },
        { business_location: null },
      ])
    ).not.toThrow();
  });
});
