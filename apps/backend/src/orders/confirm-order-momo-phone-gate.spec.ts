jest.mock('../notifications/notifications.service', () => ({
  NotificationsService: class NotificationsService {},
}));

import { HttpStatus } from '@nestjs/common';
import { OrdersService } from './orders.service';

type GateOrder = {
  business_location?: {
    address?: { country?: string | null } | null;
    mobile_payment_phone?: { is_verified?: boolean } | null;
  } | null;
};

/**
 * Calls OrdersService.assertMerchantConfirmPhoneReady. Sale checkout uses
 * isLocationPurchaseEnabled and must stay open; this gate uses payout readiness.
 */
describe('confirmOrder MoMo phone gate', () => {
  function gate(countries: Array<{ country?: string | null }> | 'throw') {
    const executeQuery = jest.fn(async () => {
      if (countries === 'throw') throw new Error('hasura down');
      return { supported_payment_systems: countries };
    });
    const service = Object.create(OrdersService.prototype) as {
      hasuraSystemService: { executeQuery: jest.Mock };
      assertMerchantConfirmPhoneReady: (order: GateOrder) => Promise<void>;
    };
    service.hasuraSystemService = { executeQuery };
    return service;
  }

  function expectPhoneBlock(order: GateOrder) {
    return expect(
      gate([{ country: 'CA' }]).assertMerchantConfirmPhoneReady(order)
    ).rejects.toMatchObject({
      status: HttpStatus.BAD_REQUEST,
      response: {
        success: false,
        error: 'MOBILE_MONEY_PHONE_UNCONFIRMED',
        message: expect.stringContaining('receive payments'),
      },
    });
  }

  it('rejects confirm when the MoMo payout phone is not verified', async () => {
    await expectPhoneBlock({
      business_location: {
        address: { country: 'CM' },
        mobile_payment_phone: { is_verified: false },
      },
    });
  });

  it('rejects confirm when the phone flag, location, or country is missing', async () => {
    await expectPhoneBlock({
      business_location: {
        address: { country: 'CM' },
        mobile_payment_phone: {},
      },
    });
    await expectPhoneBlock({ business_location: null });
    await expectPhoneBlock({
      business_location: {
        address: { country: '   ' },
        mobile_payment_phone: null,
      },
    });
  });

  it('allows confirm when the payout phone is verified', async () => {
    await expect(
      gate([]).assertMerchantConfirmPhoneReady({
        business_location: {
          address: { country: 'CM' },
          mobile_payment_phone: { is_verified: true },
        },
      })
    ).resolves.toBeUndefined();
  });

  it('allows a Stripe-country location with no verified phone', async () => {
    await expect(
      gate([{ country: ' ca ' }]).assertMerchantConfirmPhoneReady({
        business_location: {
          address: { country: ' ca ' },
          mobile_payment_phone: null,
        },
      })
    ).resolves.toBeUndefined();
  });

  it('trims the location country before treating it as outside Stripe', async () => {
    await expectPhoneBlock({
      business_location: {
        address: { country: ' cm ' },
        mobile_payment_phone: { is_verified: false },
      },
    });
  });

  it('does not confirm when the Stripe country list cannot be loaded', async () => {
    await expect(
      gate('throw').assertMerchantConfirmPhoneReady({
        business_location: {
          address: { country: 'CA' },
          mobile_payment_phone: { is_verified: true },
        },
      })
    ).rejects.toThrow('hasura down');
  });
});
