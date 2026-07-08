import { StripeCaptureService } from './stripe-capture.service';

describe('StripeCaptureService', () => {
  let service: StripeCaptureService;
  let databaseService: {
    getTransactionByEntityId: jest.Mock;
  };
  let accountsService: {
    hasTransactionForReference: jest.Mock;
    registerTransaction: jest.Mock;
  };

  beforeEach(() => {
    databaseService = {
      getTransactionByEntityId: jest.fn(),
    };
    accountsService = {
      hasTransactionForReference: jest.fn(),
      registerTransaction: jest.fn(),
    };
    service = new StripeCaptureService(
      {} as any,
      databaseService as any,
      { get: jest.fn() } as any,
      accountsService as any
    );
  });

  it('does not double-credit an already recorded Stripe deposit', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue({
      id: '6f8c2a89-3c58-41c1-80cc-04815bb2c7d1',
      account_id: 'account-123',
      amount: 25,
      currency: 'CAD',
      reference: 'stripe-ref',
      transaction_type: 'PAYMENT',
    });
    accountsService.hasTransactionForReference.mockResolvedValue(true);

    await expect(
      service.creditWalletForCapturedOrder('ORD-123')
    ).resolves.toBe('account-123');

    expect(accountsService.hasTransactionForReference).toHaveBeenCalledWith(
      '6f8c2a89-3c58-41c1-80cc-04815bb2c7d1'
    );
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
  });
});
