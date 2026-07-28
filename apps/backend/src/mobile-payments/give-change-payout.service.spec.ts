import { GiveChangePayoutService } from './give-change-payout.service';

describe('GiveChangePayoutService', () => {
  const databaseService = {
    createTransaction: jest.fn(),
    updateTransaction: jest.fn(),
  };
  const mobilePaymentsService = {
    initiatePayment: jest.fn(),
  };
  const accountsService = {
    getAccountBalance: jest.fn(),
    registerTransaction: jest.fn(),
    registerHoldIfNotExists: jest.fn(),
    registerReleaseIfNotExists: jest.fn(),
  };

  let service: GiveChangePayoutService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GiveChangePayoutService(
      databaseService as never,
      mobilePaymentsService as never,
      accountsService as never
    );
    accountsService.getAccountBalance.mockResolvedValue({
      availableBalance: 10000,
      currency: 'XAF',
    });
    databaseService.createTransaction.mockResolvedValue({
      id: 'mobile-tx-1',
      reference: 'P12345678abcd',
    });
    mobilePaymentsService.initiatePayment.mockResolvedValue({
      success: true,
      transactionId: 'provider-ref-1',
      message: 'CREATED',
      provider: 'freemopay',
    });
    databaseService.updateTransaction.mockResolvedValue(undefined);
    accountsService.registerHoldIfNotExists.mockResolvedValue({
      success: true,
      transactionId: 'hold-1',
    });
    accountsService.registerReleaseIfNotExists.mockResolvedValue({
      success: true,
      transactionId: 'release-1',
    });
  });

  it('reserves funds with a hold and does not debit wallet on provider accept', async () => {
    const result = await service.executeGiveChangePayout(
      {
        amount: 5000,
        currency: 'XAF',
        description: 'Auto payout',
        customerPhone: '+237600000000',
        accountId: 'acct-1',
        provider: 'freemopay',
      },
      { throwOnWithdrawalFailure: false }
    );

    expect(result.success).toBe(true);
    expect(result.data?.transactionId).toBe('mobile-tx-1');
    expect(accountsService.registerHoldIfNotExists).toHaveBeenCalledWith({
      accountId: 'acct-1',
      amount: 5000,
      referenceId: 'mobile-tx-1',
      memo: expect.stringContaining('GIVE_CHANGE hold'),
    });
    expect(databaseService.updateTransaction).toHaveBeenCalledWith('mobile-tx-1', {
      transaction_id: 'provider-ref-1',
    });
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
  });

  it('releases hold when provider initiation fails', async () => {
    mobilePaymentsService.initiatePayment.mockResolvedValue({
      success: false,
      message: 'Insufficient funds',
      errorCode: 'INSUFFICIENT_FUNDS',
    });

    await service.executeGiveChangePayout(
      {
        amount: 5000,
        currency: 'XAF',
        description: 'Auto payout',
        customerPhone: '+237600000000',
        accountId: 'acct-1',
      },
      { throwOnWithdrawalFailure: false }
    );

    expect(accountsService.registerReleaseIfNotExists).toHaveBeenCalledWith({
      accountId: 'acct-1',
      amount: 5000,
      referenceId: 'mobile-tx-1',
      memo: expect.stringContaining('GIVE_CHANGE release'),
    });
  });

  it('marks tx failed when provider initiation fails', async () => {
    mobilePaymentsService.initiatePayment.mockResolvedValue({
      success: false,
      message: 'Insufficient funds',
      errorCode: 'INSUFFICIENT_FUNDS',
    });

    const result = await service.executeGiveChangePayout(
      {
        amount: 5000,
        currency: 'XAF',
        description: 'Auto payout',
        customerPhone: '+237600000000',
        accountId: 'acct-1',
      },
      { throwOnWithdrawalFailure: false }
    );

    expect(result.success).toBe(false);
    expect(databaseService.updateTransaction).toHaveBeenCalledWith(
      'mobile-tx-1',
      expect.objectContaining({ status: 'failed' })
    );
    expect(accountsService.registerTransaction).not.toHaveBeenCalled();
  });
});
