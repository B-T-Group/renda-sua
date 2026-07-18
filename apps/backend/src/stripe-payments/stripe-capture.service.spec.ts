import { StripeCaptureService } from './stripe-capture.service';

describe('StripeCaptureService', () => {
  const databaseService = {
    getTransactionByEntityId: jest.fn(),
  };
  const accountsService = {
    registerTransactionIfMissing: jest.fn(),
  };
  const service = new StripeCaptureService(
    {} as any,
    databaseService as any,
    {} as any,
    accountsService as any
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('credits a captured order through the idempotent ledger path', async () => {
    databaseService.getTransactionByEntityId.mockResolvedValue({
      id: '9eea761b-b77e-47c4-b494-6002d0f5c478',
      account_id: 'account-1',
      amount: 125,
      currency: 'USD',
      reference: 'PAY-1',
      transaction_type: 'PAYMENT',
    });
    accountsService.registerTransactionIfMissing.mockResolvedValue({
      success: true,
    });

    await expect(service.creditWalletForCapturedOrder('ORD-1')).resolves.toBe(
      'account-1'
    );
    expect(accountsService.registerTransactionIfMissing).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'account-1',
        transactionType: 'deposit',
        referenceId: '9eea761b-b77e-47c4-b494-6002d0f5c478',
      })
    );
  });
});
