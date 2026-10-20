/**
 * Routing logic for top-up payment methods
 */

export interface TopUpRoute {
  endpoint: 'initiate' | 'mtn-legacy';
  body: {
    amount?: number;
    currency?: string;
    description?: string;
    customerPhone?: string;
    accountId?: string;
    paymentMethod?: string;
    transactionType?: string;
    provider?: string;
    phoneNumber?: string;
  };
}

export function resolveTopUpRequest(
  paymentMethod: string,
  phoneNumber: string,
  amount: string,
  currency: string,
  accountId: string
): TopUpRoute {
  // Route fedapay, airtel-money, and moov-money through /mobile-payments/initiate
  if (
    paymentMethod === 'fedapay' ||
    paymentMethod === 'airtel-money' ||
    paymentMethod === 'moov-money'
  ) {
    return {
      endpoint: 'initiate',
      body: {
        amount: parseFloat(amount),
        currency,
        description: 'Account Top Up',
        customerPhone: phoneNumber,
        accountId,
        paymentMethod: 'mobile_money',
        transactionType: 'PAYMENT',
        provider: paymentMethod,
      },
    };
  }

  // Route mtn-momo through legacy endpoint
  if (paymentMethod === 'mtn-momo') {
    return {
      endpoint: 'mtn-legacy',
      body: {
        amount,
        phoneNumber,
        currency,
      },
    };
  }

  // Unknown provider
  throw new Error(`Unknown payment provider: ${paymentMethod}`);
}
