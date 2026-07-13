import { StripeService } from './stripe.service';

describe('StripeService', () => {
  const createAccount = jest.fn();
  let nodeEnv = 'production';
  let service: StripeService;

  beforeEach(() => {
    jest.clearAllMocks();
    nodeEnv = 'production';
    service = new StripeService({
      get: jest.fn((key: string) => {
        if (key === 'app.nodeEnv') return nodeEnv;
        return undefined;
      }),
    } as never);
    (service as any).client = { accounts: { create: createAccount } };
  });

  it('prefills profile fields without test identity data in production', async () => {
    createAccount.mockResolvedValue({ id: 'acct_123' });

    await service.createExpressAccount({
      country: 'CA',
      email: 'owner@example.com',
      userId: 'user-123',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '+15145550123',
      businessName: 'Ada Rentals',
    });

    const params = createAccount.mock.calls[0][0];
    expect(params).toMatchObject({
      type: 'express',
      country: 'CA',
      email: 'owner@example.com',
      business_type: 'individual',
      metadata: { userId: 'user-123' },
    });
    expect(params.business_profile).toMatchObject({
      url: 'https://www.rendasua.com',
      product_description: 'Sell my stock online',
      mcc: '5999',
      name: 'Ada Rentals',
    });
    expect(params.individual).toEqual({
      email: 'owner@example.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      phone: '+15145550123',
    });
  });

  it('adds Stripe test identity prefill only outside production', async () => {
    nodeEnv = 'development';
    createAccount.mockResolvedValue({ id: 'acct_123' });

    await service.createExpressAccount({
      country: 'CA',
      email: 'owner@example.com',
      userId: 'user-123',
      phone: '5145550123',
    });

    expect(createAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        individual: expect.objectContaining({
          dob: { day: 1, month: 1, year: 1901 },
          address: {
            line1: 'address_full_match',
            city: 'Montreal',
            state: 'QC',
            postal_code: 'H2Y1C6',
            country: 'CA',
          },
        }),
      }),
      { idempotencyKey: 'connect_account_user-123' }
    );
    expect(createAccount.mock.calls[0][0].individual.phone).toBeUndefined();
  });
});
