import { HttpException, HttpStatus } from '@nestjs/common';
import {
  fetchStripeEnabledCountries,
  isLocationPaymentsEnabled,
  isLocationPurchaseEnabled,
} from '../inventory-items/inventory-catalog-eligibility.util';

jest.mock('../inventory-items/inventory-catalog-eligibility.util', () => ({
  fetchStripeEnabledCountries: jest.fn(),
  isLocationPaymentsEnabled: jest.fn(),
  isLocationPurchaseEnabled: jest.fn(),
}));

type ConfirmPhoneGateHarness = {
  assertMerchantConfirmPhoneReady: (order: unknown) => Promise<void>;
  hasuraSystemService: unknown;
};

describe('confirmOrder MoMo phone gate', () => {
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

  function harness(): ConfirmPhoneGateHarness {
    // Mirror OrdersService.assertMerchantConfirmPhoneReady without booting Nest.
    const service = {
      hasuraSystemService: {},
      async assertMerchantConfirmPhoneReady(order: {
        business_location?: {
          address?: { country?: string | null } | null;
          mobile_payment_phone?: { is_verified?: boolean } | null;
        } | null;
      }) {
        const stripeCountries = await fetchStripeEnabledCountries(
          this.hasuraSystemService as never
        );
        if (isLocationPaymentsEnabled(order.business_location, stripeCountries)) {
          return;
        }
        throw new HttpException(
          {
            success: false,
            error: 'MOBILE_MONEY_PHONE_UNCONFIRMED',
            message:
              'Confirm that your mobile money number can receive payments before accepting this order.',
          },
          HttpStatus.BAD_REQUEST
        );
      },
    } as ConfirmPhoneGateHarness;
    return service;
  }

  it('rejects confirm when MoMo location phone is not verified', async () => {
    const service = harness();
    paymentsEnabled.mockReturnValue(false);
    await expect(
      service.assertMerchantConfirmPhoneReady({
        business_location: {
          address: { country: 'CM' },
          mobile_payment_phone: { is_verified: false },
        },
      })
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: { error: 'MOBILE_MONEY_PHONE_UNCONFIRMED' },
    });
  });

  it('allows confirm when location payments are enabled', async () => {
    const service = harness();
    paymentsEnabled.mockReturnValue(true);
    await expect(
      service.assertMerchantConfirmPhoneReady({
        business_location: {
          address: { country: 'CM' },
          mobile_payment_phone: { is_verified: true },
        },
      })
    ).resolves.toBeUndefined();
  });

  it('keeps purchase enabled for unverified MoMo while rentals stay gated', () => {
    (isLocationPurchaseEnabled as jest.Mock).mockReturnValue(true);
    (isLocationPaymentsEnabled as jest.Mock).mockReturnValue(false);
    expect(
      isLocationPurchaseEnabled(
        {
          address: { country: 'CM' },
          mobile_payment_phone: { is_verified: false },
        },
        ['CA']
      )
    ).toBe(true);
    expect(
      isLocationPaymentsEnabled(
        {
          address: { country: 'CM' },
          mobile_payment_phone: { is_verified: false },
        },
        ['CA']
      )
    ).toBe(false);
  });
});
