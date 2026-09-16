import { ReelAiTokenPaymentCallbackHandler } from './reel-ai-token-payment-callback.handler';

describe('ReelAiTokenPaymentCallbackHandler', () => {
  const reelAiTokensService = {
    processPaymentSuccess: jest.fn(),
  };

  let handler: ReelAiTokenPaymentCallbackHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new ReelAiTokenPaymentCallbackHandler(reelAiTokensService as never);
  });

  it('only supports reel_ai_token payment entities', () => {
    expect(handler.supportsPaymentEntity('reel_ai_token')).toBe(true);
    expect(handler.supportsPaymentEntity('token')).toBe(false);
    expect(handler.supportsPaymentEntity('order')).toBe(false);
    expect(handler.supportsPaymentEntity(undefined)).toBe(false);
  });

  it('delegates successful payments to the reel AI token service', async () => {
    const transaction = {
      reference: 'reel-ai-pay-1',
      entity_id: 'business-1',
      amount: 1500,
      currency: 'XAF',
      payment_entity: 'reel_ai_token',
    };

    await handler.onPaymentSuccess(transaction as never);

    expect(reelAiTokensService.processPaymentSuccess).toHaveBeenCalledWith(
      transaction
    );
  });
});
