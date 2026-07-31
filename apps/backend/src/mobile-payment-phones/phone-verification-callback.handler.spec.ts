import { PhoneVerificationCallbackHandler } from './phone-verification-callback.handler';

describe('PhoneVerificationCallbackHandler', () => {
  const mobilePaymentPhonesService = {
    completeVerificationFromTransaction: jest.fn(),
  };

  let handler: PhoneVerificationCallbackHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = new PhoneVerificationCallbackHandler(
      mobilePaymentPhonesService as never
    );
  });

  it('only supports phone_verification entities', () => {
    expect(handler.supportsPaymentEntity('phone_verification')).toBe(true);
    expect(handler.supportsPaymentEntity('order')).toBe(false);
    expect(handler.supportsPaymentEntity(undefined)).toBe(false);
  });

  it('delegates successful verification payments to the phones service', async () => {
    const transaction = {
      id: 'tx-1',
      entity_id: 'phone-1',
      payment_entity: 'phone_verification',
    };

    await handler.onPaymentSuccess(transaction as never);

    expect(
      mobilePaymentPhonesService.completeVerificationFromTransaction
    ).toHaveBeenCalledWith('phone-1', 'tx-1');
  });

  it('skips when entity_id is missing', async () => {
    await handler.onPaymentSuccess({ id: 'tx-2', entity_id: '' } as never);

    expect(
      mobilePaymentPhonesService.completeVerificationFromTransaction
    ).not.toHaveBeenCalled();
  });
});
