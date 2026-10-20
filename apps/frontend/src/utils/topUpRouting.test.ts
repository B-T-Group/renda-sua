import { resolveTopUpRequest } from './topUpRouting';

describe('resolveTopUpRequest', () => {
  const phoneNumber = '+22878123456';
  const amount = '1000';
  const currency = 'XOF';
  const accountId = 'account-123';

  test('fedapay routes to /mobile-payments/initiate with provider fedapay', () => {
    const result = resolveTopUpRequest('fedapay', phoneNumber, amount, currency, accountId);

    expect(result.endpoint).toBe('initiate');
    expect(result.body).toEqual({
      amount: 1000,
      currency: 'XOF',
      description: 'Account Top Up',
      customerPhone: '+22878123456',
      accountId: 'account-123',
      paymentMethod: 'mobile_money',
      transactionType: 'PAYMENT',
      provider: 'fedapay',
    });
  });

  test('airtel-money routes to /mobile-payments/initiate WITHOUT provider field', () => {
    const result = resolveTopUpRequest('airtel-money', '+237671234567', amount, 'XAF', accountId);

    expect(result.endpoint).toBe('initiate');
    expect(result.body).toEqual({
      amount: 1000,
      currency: 'XAF',
      description: 'Account Top Up',
      customerPhone: '+237671234567',
      accountId: 'account-123',
      paymentMethod: 'mobile_money',
      transactionType: 'PAYMENT',
      // No provider field - backend auto-resolves from phone number
    });
    // Explicitly verify provider is NOT present
    expect('provider' in result.body).toBe(false);
  });

  test('moov-money routes to /mobile-payments/initiate WITHOUT provider field', () => {
    const result = resolveTopUpRequest('moov-money', phoneNumber, amount, currency, accountId);

    expect(result.endpoint).toBe('initiate');
    expect(result.body).toEqual({
      amount: 1000,
      currency: 'XOF',
      description: 'Account Top Up',
      customerPhone: '+22878123456',
      accountId: 'account-123',
      paymentMethod: 'mobile_money',
      transactionType: 'PAYMENT',
    });
    // Explicitly verify provider is NOT present
    expect('provider' in result.body).toBe(false);
  });

  test('mtn-momo routes to legacy endpoint', () => {
    const result = resolveTopUpRequest('mtn-momo', '+237671234567', amount, 'XAF', accountId);

    expect(result.endpoint).toBe('mtn-legacy');
    expect(result.body).toEqual({
      amount: '1000',
      phoneNumber: '+237671234567',
      currency: 'XAF',
    });
  });

  test('unknown provider throws error', () => {
    expect(() => {
      resolveTopUpRequest('unknown-provider', phoneNumber, amount, currency, accountId);
    }).toThrow('Unknown payment provider: unknown-provider');
  });

  test('empty string provider throws error', () => {
    expect(() => {
      resolveTopUpRequest('', phoneNumber, amount, currency, accountId);
    }).toThrow('Unknown payment provider: ');
  });
});
