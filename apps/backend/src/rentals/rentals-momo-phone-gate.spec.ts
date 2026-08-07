import { HttpException } from '@nestjs/common';
import {
  fetchStripeEnabledCountries,
  isLocationPaymentsEnabled,
} from '../inventory-items/inventory-catalog-eligibility.util';
import { RentalsService } from './rentals.service';

jest.mock('../inventory-items/inventory-catalog-eligibility.util', () => ({
  fetchStripeEnabledCountries: jest.fn(),
  isLocationPaymentsEnabled: jest.fn(),
}));

type RentalsPhoneGateHarness = {
  assertListingBookable: (listing: unknown) => Promise<void>;
  assertListingActiveAndApproved: (listing: unknown) => void;
  assertListingLocationPaymentsEnabled: (listing: unknown) => Promise<void>;
  filterListingsByPaymentsEnabled: (rows: unknown[]) => Promise<unknown[]>;
  hasuraSystemService: unknown;
};

describe('RentalsService MoMo location phone gate', () => {
  const fetchStripe = fetchStripeEnabledCountries as jest.MockedFunction<
    typeof fetchStripeEnabledCountries
  >;
  const paymentsEnabled = isLocationPaymentsEnabled as jest.MockedFunction<
    typeof isLocationPaymentsEnabled
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchStripe.mockResolvedValue(['CA']);
  });

  function harness(): RentalsPhoneGateHarness {
    const service = Object.create(
      RentalsService.prototype
    ) as RentalsPhoneGateHarness;
    service.hasuraSystemService = {};
    return service;
  }

  it('blocks booking when MoMo location payments are not enabled', async () => {
    const service = harness();
    paymentsEnabled.mockReturnValue(false);
    await expect(
      service.assertListingLocationPaymentsEnabled({
        business_location: {
          address: { country: 'CM' },
          mobile_payment_phone: { is_verified: false },
        },
      })
    ).rejects.toBeInstanceOf(HttpException);
    expect(paymentsEnabled).toHaveBeenCalledWith(
      {
        address: { country: 'CM' },
        mobile_payment_phone: { is_verified: false },
      },
      ['CA']
    );
  });

  it('allows booking when location payments are enabled', async () => {
    const service = harness();
    paymentsEnabled.mockReturnValue(true);
    await expect(
      service.assertListingLocationPaymentsEnabled({
        business_location: {
          address: { country: 'CM' },
          mobile_payment_phone: { is_verified: true },
        },
      })
    ).resolves.toBeUndefined();
  });

  it('filters public listings that lack MoMo phone readiness', async () => {
    const service = harness();
    paymentsEnabled.mockImplementation((location) => {
      return location?.mobile_payment_phone?.is_verified === true;
    });
    const rows = [
      {
        id: 'ok',
        business_location: {
          mobile_payment_phone: { is_verified: true },
          address: { country: 'CM' },
        },
      },
      {
        id: 'blocked',
        business_location: {
          mobile_payment_phone: { is_verified: false },
          address: { country: 'CM' },
        },
      },
    ];
    const filtered = (await service.filterListingsByPaymentsEnabled(
      rows
    )) as Array<{ id: string }>;
    expect(filtered.map((r) => r.id)).toEqual(['ok']);
  });

  it('assertListingBookable requires payments after active checks', async () => {
    const service = harness();
    service.assertListingActiveAndApproved = jest.fn();
    paymentsEnabled.mockReturnValue(false);
    await expect(
      service.assertListingBookable({
        is_active: true,
        moderation_status: 'approved',
        rental_item: {
          is_active: true,
          business: { can_accept_orders: true },
        },
        business_location: {
          is_active: true,
          address: { country: 'CM' },
          mobile_payment_phone: null,
        },
      })
    ).rejects.toBeInstanceOf(HttpException);
    expect(service.assertListingActiveAndApproved).toHaveBeenCalled();
  });
});
