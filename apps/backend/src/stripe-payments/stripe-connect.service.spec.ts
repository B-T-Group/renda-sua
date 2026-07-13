import { HttpStatus } from '@nestjs/common';
import { StripeConnectService } from './stripe-connect.service';

describe('StripeConnectService', () => {
  const stripeService = { createExpressAccount: jest.fn() };
  const hasuraService = {
    executeQuery: jest.fn(),
    executeMutation: jest.fn(),
  };
  const paymentRouting = {
    getUserCountryCode: jest.fn(),
    resolveRailForUser: jest.fn(),
  };
  const configService = { get: jest.fn() };
  const merchantLifecycleService = {
    getBusinessIdForUser: jest.fn(),
    upsertPaymentAccount: jest.fn(),
  };
  let service: StripeConnectService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StripeConnectService(
      stripeService as never,
      hasuraService as never,
      paymentRouting as never,
      configService as never,
      merchantLifecycleService as never
    );
  });

  it('creates a Connect account with user profile prefill and persists status', async () => {
    hasuraService.executeQuery
      .mockResolvedValueOnce({ stripe_connect_accounts: [] })
      .mockResolvedValueOnce({
        users_by_pk: {
          email: 'owner@example.com',
          first_name: 'Ada',
          last_name: 'Lovelace',
          phone_number: '+15145550123',
          business: { name: 'Ada Rentals' },
        },
      });
    paymentRouting.getUserCountryCode.mockResolvedValue('CA');
    stripeService.createExpressAccount.mockResolvedValue({
      id: 'acct_123',
      default_currency: 'cad',
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
    });
    hasuraService.executeMutation.mockResolvedValue({
      insert_stripe_connect_accounts_one: { id: 'row-123' },
    });

    await expect(service.ensureAccount('user-123')).resolves.toEqual({
      id: 'row-123',
    });
    expect(stripeService.createExpressAccount).toHaveBeenCalledWith({
      country: 'CA',
      email: 'owner@example.com',
      userId: 'user-123',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '+15145550123',
      businessName: 'Ada Rentals',
    });
    expect(hasuraService.executeMutation).toHaveBeenCalledWith(
      expect.stringContaining('insert_stripe_connect_accounts_one'),
      {
        data: expect.objectContaining({
          user_id: 'user-123',
          stripe_account_id: 'acct_123',
          default_currency: 'CAD',
          status: 'pending',
        }),
      }
    );
  });

  it('rejects account creation when the user country cannot be resolved', async () => {
    hasuraService.executeQuery.mockResolvedValue({ stripe_connect_accounts: [] });
    paymentRouting.getUserCountryCode.mockResolvedValue(undefined);

    try {
      await service.ensureAccount('user-123');
      fail('Expected ensureAccount to reject missing country');
    } catch (error: any) {
      expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
    expect(stripeService.createExpressAccount).not.toHaveBeenCalled();
    expect(hasuraService.executeMutation).not.toHaveBeenCalled();
  });
});
