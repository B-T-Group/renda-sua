/**
 * Routing logic for top-up payment methods
 */

export interface LegacyTopUpBody {
  amount: string;
  phoneNumber: string;
  currency: string;
}

export type TopUpRoute =
  | {
      endpoint: 'initiate';
      body: {
        amount: number;
        currency: string;
        description: string;
        customerPhone?: string;
        accountId?: string;
        paymentMethod?: string;
        transactionType?: string;
        provider?: 'mypvit' | 'airtel' | 'moov' | 'mtn' | 'fedapay';
      };
    }
  | { endpoint: 'mtn-legacy'; body: LegacyTopUpBody };

export function resolveTopUpRequest(
  paymentMethod: string,
  phoneNumber: string,
  amount: string,
  currency: string,
  accountId: string
): TopUpRoute {
  // Route fedapay through /mobile-payments/initiate with provider field
  if (paymentMethod === 'fedapay') {
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
        provider: 'fedapay',
      },
    };
  }

  // Route airtel-money and moov-money through /mobile-payments/initiate WITHOUT provider
  // (backend resolves provider automatically from phone number)
  if (paymentMethod === 'airtel-money' || paymentMethod === 'moov-money') {
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
        // No provider field - backend auto-resolves
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
