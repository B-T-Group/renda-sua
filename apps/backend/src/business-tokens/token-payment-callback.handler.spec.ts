import { TokenPaymentCallbackHandler } from './token-payment-callback.handler';

describe('TokenPaymentCallbackHandler', () => {
  const businessTokensService = {
    processTokenPaymentSuccess: jest.fn(),
  };

  let handler: TokenPaymentCallbackHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new TokenPaymentCallbackHandler(businessTokensService as never);
  });

  it('only supports token payment entities', () => {
    expect(handler.supportsPaymentEntity('token')).toBe(true);
    expect(handler.supportsPaymentEntity('order')).toBe(false);
    expect(handler.supportsPaymentEntity(undefined)).toBe(false);
  });

  it('delegates successful token payments to the token service', async () => {
    const transaction = {
      reference: 'token-pay-1',
      entity_id: 'business-1',
      amount: 800,
      currency: 'XAF',
      payment_entity: 'token',
    };

    await handler.onPaymentSuccess(transaction as never);

    expect(businessTokensService.processTokenPaymentSuccess).toHaveBeenCalledWith(
      transaction
    );
  });
});
